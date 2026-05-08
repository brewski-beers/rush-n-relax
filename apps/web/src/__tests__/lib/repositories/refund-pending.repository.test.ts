/**
 * BDD coverage for the refund-pending repository (#406).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeDocSnap {
  exists: boolean;
  data: () => FirebaseFirestore.DocumentData;
}

const {
  docDeleteMock,
  txGetMock,
  txSetMock,
  txUpdateMock,
  runTransactionMock,
  whereMock,
  orderByMock,
  limitMock,
  getMock,
  collectionMock,
  docFnMock,
  getAdminFirestoreMock,
} = vi.hoisted(() => {
  const docDeleteMock = vi.fn().mockResolvedValue(undefined);

  const txGetMock = vi.fn();
  const txSetMock = vi.fn();
  const txUpdateMock = vi.fn();

  const runTransactionMock = vi.fn(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ get: txGetMock, set: txSetMock, update: txUpdateMock });
    }
  );

  // Query chain: collection().where().orderBy().limit().get()
  const getMock = vi.fn();
  const limitMock = vi.fn(() => ({ get: getMock }));
  const orderByMock = vi.fn(() => ({ limit: limitMock }));
  const whereMock = vi.fn(() => ({ orderBy: orderByMock }));

  const docFnMock = vi.fn((id?: string) => ({
    id: id ?? 'auto-id',
    delete: docDeleteMock,
  }));

  const collectionMock = vi.fn(() => ({
    doc: docFnMock,
    where: whereMock,
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
    runTransaction: runTransactionMock,
  }));

  return {
    docDeleteMock,
    txGetMock,
    txSetMock,
    txUpdateMock,
    runTransactionMock,
    whereMock,
    orderByMock,
    limitMock,
    getMock,
    collectionMock,
    docFnMock,
    getAdminFirestoreMock,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (value: Date | string | number | undefined) =>
    value instanceof Date ? value : value ? new Date(value) : new Date(0),
}));

import {
  enqueueRefundPending,
  listRefundsPendingForRetry,
  markRefundPendingRetryFailed,
  deleteRefundPending,
  backoffMsFor,
} from '@/lib/repositories/refund-pending.repository';

beforeEach(() => {
  docDeleteMock.mockClear();
  txGetMock.mockReset();
  txSetMock.mockReset();
  txUpdateMock.mockReset();
  runTransactionMock.mockClear();
  whereMock.mockClear();
  orderByMock.mockClear();
  limitMock.mockClear();
  getMock.mockReset();
  collectionMock.mockClear();
  docFnMock.mockClear();
});

describe('enqueueRefundPending', () => {
  it('Given no existing row, When enqueued, Then it writes a new doc with retryCount=0', async () => {
    const snap: FakeDocSnap = { exists: false, data: () => ({}) };
    txGetMock.mockResolvedValue(snap);

    await enqueueRefundPending({
      cloverPaymentId: 'pay-1',
      orderId: 'ord-1',
      sessionId: 'sess-1',
      error: 'clover 500',
    });

    expect(docFnMock).toHaveBeenCalledWith('pay-1');
    expect(txSetMock).toHaveBeenCalledTimes(1);
    const [, payload] = txSetMock.mock.calls[0];
    expect(payload).toEqual(
      expect.objectContaining({
        cloverPaymentId: 'pay-1',
        orderId: 'ord-1',
        sessionId: 'sess-1',
        retryCount: 0,
        lastError: 'clover 500',
        createdBy: 'finalize',
      })
    );
    expect(payload.attemptedAt).toBeInstanceOf(Date);
    expect(payload.lastAttemptedAt).toBeInstanceOf(Date);
  });

  it('Given an existing row, When enqueued again, Then it updates lastError + lastAttemptedAt only', async () => {
    const snap: FakeDocSnap = {
      exists: true,
      data: () => ({ retryCount: 2, attemptedAt: new Date(0) }),
    };
    txGetMock.mockResolvedValue(snap);

    await enqueueRefundPending({
      cloverPaymentId: 'pay-1',
      orderId: 'ord-1',
      sessionId: 'sess-1',
      error: 'second failure',
    });

    expect(txSetMock).not.toHaveBeenCalled();
    expect(txUpdateMock).toHaveBeenCalledTimes(1);
    const [, patch] = txUpdateMock.mock.calls[0];
    expect(patch.lastError).toBe('second failure');
    expect(patch.lastAttemptedAt).toBeInstanceOf(Date);
    // retryCount is NOT clobbered.
    expect(patch.retryCount).toBeUndefined();
  });

  it('Given an empty cloverPaymentId, When enqueued, Then it throws', async () => {
    await expect(
      enqueueRefundPending({
        cloverPaymentId: '',
        orderId: 'o',
        sessionId: 's',
        error: 'e',
      })
    ).rejects.toThrow(/cloverPaymentId/);
  });

  it('Given a very long error, When enqueued, Then lastError is truncated to 500 chars', async () => {
    txGetMock.mockResolvedValue({ exists: false, data: () => ({}) });
    const longErr = 'x'.repeat(1200);

    await enqueueRefundPending({
      cloverPaymentId: 'pay-long',
      orderId: 'o',
      sessionId: 's',
      error: longErr,
    });

    const [, payload] = txSetMock.mock.calls[0];
    expect(payload.lastError.length).toBe(500);
  });
});

describe('listRefundsPendingForRetry', () => {
  function makeQuerySnap(
    docs: Array<{ id: string; data: FirebaseFirestore.DocumentData }>
  ) {
    return {
      docs: docs.map(d => ({
        id: d.id,
        data: () => d.data,
      })),
    };
  }

  it('Given rows under maxRetries with elapsed backoff, When listed, Then returns them', async () => {
    const now = new Date('2026-05-08T12:00:00Z');
    const veryOld = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
    getMock.mockResolvedValue(
      makeQuerySnap([
        {
          id: 'pay-A',
          data: {
            cloverPaymentId: 'pay-A',
            orderId: 'o-A',
            sessionId: 's-A',
            attemptedAt: veryOld,
            lastAttemptedAt: veryOld,
            retryCount: 0,
            lastError: 'e',
            createdBy: 'finalize',
          },
        },
      ])
    );

    const out = await listRefundsPendingForRetry({ maxRetries: 5, now });

    expect(whereMock).toHaveBeenCalledWith('retryCount', '<', 5);
    expect(out).toHaveLength(1);
    expect(out[0].cloverPaymentId).toBe('pay-A');
  });

  it('Given a row whose backoff window has not elapsed, When listed, Then it is skipped', async () => {
    const now = new Date('2026-05-08T12:00:00Z');
    // retryCount=2 → 4-minute backoff. lastAttemptedAt 1 minute ago.
    const oneMinAgo = new Date(now.getTime() - 60 * 1000);
    getMock.mockResolvedValue(
      makeQuerySnap([
        {
          id: 'pay-B',
          data: {
            cloverPaymentId: 'pay-B',
            orderId: 'o-B',
            sessionId: 's-B',
            attemptedAt: oneMinAgo,
            lastAttemptedAt: oneMinAgo,
            retryCount: 2,
            lastError: 'e',
            createdBy: 'finalize',
          },
        },
      ])
    );

    const out = await listRefundsPendingForRetry({ maxRetries: 5, now });

    expect(out).toHaveLength(0);
  });
});

describe('markRefundPendingRetryFailed', () => {
  it('Given an existing row, When marked failed, Then retryCount increments and lastError is updated', async () => {
    const snap: FakeDocSnap = {
      exists: true,
      data: () => ({ retryCount: 1 }),
    };
    txGetMock.mockResolvedValue(snap);

    await markRefundPendingRetryFailed('pay-1', 'still broken');

    expect(txUpdateMock).toHaveBeenCalledTimes(1);
    const [, patch] = txUpdateMock.mock.calls[0];
    expect(patch.retryCount).toBe(2);
    expect(patch.lastError).toBe('still broken');
    expect(patch.lastAttemptedAt).toBeInstanceOf(Date);
  });

  it('Given a missing row, When marked failed, Then no update is issued', async () => {
    const snap: FakeDocSnap = { exists: false, data: () => ({}) };
    txGetMock.mockResolvedValue(snap);

    await markRefundPendingRetryFailed('pay-missing', 'gone');

    expect(txUpdateMock).not.toHaveBeenCalled();
  });
});

describe('deleteRefundPending', () => {
  it('Given a paymentId, When deleted, Then the doc delete is invoked', async () => {
    await deleteRefundPending('pay-1');
    expect(docFnMock).toHaveBeenCalledWith('pay-1');
    expect(docDeleteMock).toHaveBeenCalledTimes(1);
  });
});

describe('backoffMsFor', () => {
  it('returns 1m / 2m / 4m / 8m / 16m for retryCount 0..4', () => {
    expect(backoffMsFor(0)).toBe(60_000);
    expect(backoffMsFor(1)).toBe(120_000);
    expect(backoffMsFor(2)).toBe(240_000);
    expect(backoffMsFor(3)).toBe(480_000);
    expect(backoffMsFor(4)).toBe(960_000);
  });
});
