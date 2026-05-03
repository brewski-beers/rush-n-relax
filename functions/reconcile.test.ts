import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const {
  whereMock,
  getMock,
  txGetMock,
  txUpdateMock,
  txSetMock,
  runTransactionMock,
  ordersDocMock,
  eventsDocMock,
  collectionMock,
  fetchMock,
} = vi.hoisted(() => {
  const whereMock = vi.fn();
  const getMock = vi.fn();
  const queryProxy: Record<string, unknown> = {};
  whereMock.mockReturnValue(queryProxy);
  queryProxy.where = whereMock;
  queryProxy.get = getMock;
  getMock.mockResolvedValue({ docs: [], size: 0 });

  const txGetMock = vi.fn();
  const txUpdateMock = vi.fn();
  const txSetMock = vi.fn();
  const runTransactionMock = vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({ get: txGetMock, update: txUpdateMock, set: txSetMock })
  );

  const ordersDocMock = vi.fn((id: string) => ({ id, path: `orders/${id}` }));
  const eventsDocMock = vi.fn(() => ({ id: 'event-id' }));
  const collectionMock = vi.fn((name: string) => {
    if (name === 'orders') {
      return { where: whereMock, doc: ordersDocMock };
    }
    if (name === 'order-events') {
      return {
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({ doc: eventsDocMock })),
        })),
      };
    }
    return { doc: vi.fn() };
  });

  const fetchMock = vi.fn();
  return {
    whereMock,
    getMock,
    txGetMock,
    txUpdateMock,
    txSetMock,
    runTransactionMock,
    ordersDocMock,
    eventsDocMock,
    collectionMock,
    fetchMock,
  };
});

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: vi.fn((_config, _handler) => ({})),
}));
vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: vi.fn(),
}));
vi.mock('firebase-functions/params', () => ({
  defineSecret: vi.fn(() => ({ value: () => '' })),
}));
vi.mock('firebase-functions/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));
vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: collectionMock,
    runTransaction: runTransactionMock,
  })),
}));

vi.stubGlobal('fetch', fetchMock);

import { reconcileAwaitingPaymentOrdersImpl } from './index';

function makeOrderDoc(
  id: string,
  data: Record<string, unknown>
): { id: string; data: () => Record<string, unknown> } {
  return { id, data: () => data };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('reconcileAwaitingPaymentOrdersImpl', () => {
  const NOW = Date.parse('2026-05-03T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ docs: [], size: 0 });
    txGetMock.mockReset();
    txUpdateMock.mockReset();
    txSetMock.mockReset();
    fetchMock.mockReset();
  });

  it('queries awaiting_payment orders with updatedAt cutoff at -10min', async () => {
    await reconcileAwaitingPaymentOrdersImpl('M', 'K', NOW);
    expect(whereMock).toHaveBeenCalledWith('status', '==', 'awaiting_payment');
    const updatedAtCall = whereMock.mock.calls.find(
      c => c[0] === 'updatedAt' && c[1] === '<='
    );
    expect(updatedAtCall).toBeDefined();
    const cutoff = updatedAtCall?.[2] as Date;
    expect(cutoff.getTime()).toBe(NOW - 10 * 60 * 1000);
  });

  it('settles a SUCCESS order to paid with cloverPaymentId in event meta', async () => {
    getMock.mockResolvedValue({
      docs: [makeOrderDoc('ord_1', { cloverCheckoutSessionId: 'cco_1' })],
      size: 1,
    });
    fetchMock.mockResolvedValue(
      jsonResponse({ elements: [{ id: 'pay_1', result: 'SUCCESS' }] })
    );
    txGetMock.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'awaiting_payment' }),
    });

    const res = await reconcileAwaitingPaymentOrdersImpl('M', 'K', NOW);
    expect(res).toEqual({ scanned: 1, settled: 1, pending: 0 });
    const updatePatch = txUpdateMock.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(updatePatch.status).toBe('paid');
    expect(updatePatch.cloverPaymentId).toBe('pay_1');
    const eventDoc = txSetMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(eventDoc.actor).toBe('system');
    expect(eventDoc.to).toBe('paid');
    expect((eventDoc.meta as Record<string, unknown>).source).toBe(
      'recovery-cron'
    );
  });

  it('marks a FAIL order as failed', async () => {
    getMock.mockResolvedValue({
      docs: [makeOrderDoc('ord_2', { cloverCheckoutSessionId: 'cco_2' })],
      size: 1,
    });
    fetchMock.mockResolvedValue(
      jsonResponse({ elements: [{ id: 'pay_x', result: 'FAIL' }] })
    );
    txGetMock.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'awaiting_payment' }),
    });

    const res = await reconcileAwaitingPaymentOrdersImpl('M', 'K', NOW);
    expect(res.settled).toBe(1);
    const updatePatch = txUpdateMock.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(updatePatch.status).toBe('failed');
  });

  it('treats an empty payments collection as PENDING (no transition)', async () => {
    getMock.mockResolvedValue({
      docs: [makeOrderDoc('ord_3', { cloverCheckoutSessionId: 'cco_3' })],
      size: 1,
    });
    fetchMock.mockResolvedValue(jsonResponse({ elements: [] }));

    const res = await reconcileAwaitingPaymentOrdersImpl('M', 'K', NOW);
    expect(res).toEqual({ scanned: 1, settled: 0, pending: 1 });
    expect(txUpdateMock).not.toHaveBeenCalled();
  });

  it('skips orders with no cloverCheckoutSessionId (counts as pending)', async () => {
    getMock.mockResolvedValue({
      docs: [makeOrderDoc('ord_no_session', {})],
      size: 1,
    });
    const res = await reconcileAwaitingPaymentOrdersImpl('M', 'K', NOW);
    expect(res).toEqual({ scanned: 1, settled: 0, pending: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('idempotent: an already-paid order (transition rejected) does not throw', async () => {
    getMock.mockResolvedValue({
      docs: [makeOrderDoc('ord_dup', { cloverCheckoutSessionId: 'cco_dup' })],
      size: 1,
    });
    fetchMock.mockResolvedValue(
      jsonResponse({ elements: [{ id: 'pay_dup', result: 'SUCCESS' }] })
    );
    // The order is already paid — txGet returns status:'paid' so the
    // transition guard inside the inline tx throws InvalidTransition,
    // which the cron must swallow.
    txGetMock.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'paid' }),
    });

    await expect(
      reconcileAwaitingPaymentOrdersImpl('M', 'K', NOW)
    ).resolves.toEqual({ scanned: 1, settled: 0, pending: 0 });
  });
});
