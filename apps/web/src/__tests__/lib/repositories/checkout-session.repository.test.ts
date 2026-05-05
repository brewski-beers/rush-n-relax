/* eslint-disable @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-argument,
                  @typescript-eslint/require-await */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeDocSnap {
  exists: boolean;
  id: string;
  data: () => FirebaseFirestore.DocumentData;
}

const {
  docGetMock,
  docSetMock,
  docUpdateMock,
  txGetMock,
  txUpdateMock,
  runTransactionMock,
  getAdminFirestoreMock,
  collectionMock,
  docFnMock,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docSetMock = vi.fn().mockResolvedValue(undefined);
  const docUpdateMock = vi.fn().mockResolvedValue(undefined);

  const txGetMock = vi.fn();
  const txUpdateMock = vi.fn();

  const runTransactionMock = vi.fn(async (fn: (tx: unknown) => unknown) => {
    return fn({ get: txGetMock, update: txUpdateMock });
  });

  const docFnMock = vi.fn((id?: string) => ({
    id: id ?? 'auto-id',
    get: docGetMock,
    set: docSetMock,
    update: docUpdateMock,
  }));

  const collectionMock = vi.fn(() => ({ doc: docFnMock }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
    runTransaction: runTransactionMock,
  }));

  return {
    docGetMock,
    docSetMock,
    docUpdateMock,
    txGetMock,
    txUpdateMock,
    runTransactionMock,
    getAdminFirestoreMock,
    collectionMock,
    docFnMock,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (value: Date | string | undefined) =>
    value ? new Date(value) : new Date(0),
}));

import {
  createCheckoutSession,
  getCheckoutSession,
  InvalidCheckoutSessionTransitionError,
  markAgeVerified,
  markCheckoutSessionCancelled,
  markCheckoutSessionCompleted,
  markCheckoutSessionExpired,
} from '@/lib/repositories/checkout-session.repository';
import type {
  CheckoutSession,
  CheckoutSessionStatus,
} from '@/types/checkout-session';

const baseInput = {
  items: [
    {
      productId: 'prod-1',
      variantId: 'default',
      productName: 'Blue Dream',
      quantity: 2,
      unitPrice: 1500,
      lineTotal: 3000,
    },
  ],
  subtotal: 3000,
  tax: 270,
  total: 3270,
  locationId: 'online',
  deliveryAddress: {
    name: 'Buyer',
    line1: '1 Main St',
    city: 'Knoxville',
    state: 'TN',
    zip: '37902',
  },
  holds: [
    { productId: 'prod-1', variantId: 'default', locationId: 'online', qty: 2 },
  ],
  cloverCheckoutSessionId: 'clover-sess-abc',
  expiresAt: new Date('2026-06-01T00:00:00Z'),
};

function makeSnap(
  status: CheckoutSessionStatus,
  extra: Record<string, unknown> = {}
): FakeDocSnap {
  return {
    exists: true,
    id: 'clover-sess-abc',
    data: () => ({
      ...baseInput,
      status,
      ageVerifiedAt: null,
      verificationId: null,
      createdAt: new Date('2026-05-01T00:00:00Z'),
      updatedAt: new Date('2026-05-01T00:00:00Z'),
      ...extra,
    }),
  };
}

describe('checkout-session.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCheckoutSession', () => {
    it('uses cloverCheckoutSessionId as the document id and writes status=awaiting_id', async () => {
      const id = await createCheckoutSession(baseInput);

      expect(id).toBe('clover-sess-abc');
      expect(collectionMock).toHaveBeenCalledWith('checkout-sessions');
      expect(docFnMock).toHaveBeenCalledWith('clover-sess-abc');
      expect(docSetMock).toHaveBeenCalledOnce();

      const [payload] = docSetMock.mock.calls[0];
      expect(payload.status).toBe('awaiting_id');
      expect(payload.ageVerifiedAt).toBeNull();
      expect(payload.verificationId).toBeNull();
      expect(payload.createdAt).toBeInstanceOf(Date);
      expect(payload.updatedAt).toBeInstanceOf(Date);
      expect(payload.expiresAt).toEqual(baseInput.expiresAt);
      expect(payload.holds).toHaveLength(1);
    });

    it('throws when cloverCheckoutSessionId is missing', async () => {
      await expect(
        createCheckoutSession({ ...baseInput, cloverCheckoutSessionId: '' })
      ).rejects.toThrow(/cloverCheckoutSessionId/);
      expect(docSetMock).not.toHaveBeenCalled();
    });

    it('omits customerEmail from payload when not provided', async () => {
      await createCheckoutSession(baseInput);
      const [payload] = docSetMock.mock.calls[0];
      expect('customerEmail' in payload).toBe(false);
    });

    it('includes customerEmail when provided', async () => {
      await createCheckoutSession({
        ...baseInput,
        customerEmail: 'b@example.com',
      });
      const [payload] = docSetMock.mock.calls[0];
      expect(payload.customerEmail).toBe('b@example.com');
    });
  });

  describe('getCheckoutSession', () => {
    it('returns null when document does not exist', async () => {
      docGetMock.mockResolvedValueOnce({ exists: false });
      const result = await getCheckoutSession('missing');
      expect(result).toBeNull();
    });

    it('hydrates a CheckoutSession with defaults applied', async () => {
      docGetMock.mockResolvedValueOnce(makeSnap('awaiting_id'));
      const session = await getCheckoutSession('clover-sess-abc');
      expect(session).not.toBeNull();
      expect(session!.id).toBe('clover-sess-abc');
      expect(session!.status).toBe('awaiting_id');
      expect(session!.ageVerifiedAt).toBeNull();
      expect(session!.verificationId).toBeNull();
      expect(session!.holds).toHaveLength(1);
      expect(session!.holds[0].variantId).toBe('default');
    });
  });

  describe('markAgeVerified', () => {
    it('transitions awaiting_id → awaiting_payment and stamps verification fields', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_id'));
      const verifiedAt = new Date('2026-05-02T12:00:00Z');

      const result = await markAgeVerified(
        'clover-sess-abc',
        'agechecker-xyz',
        verifiedAt
      );

      expect(txUpdateMock).toHaveBeenCalledOnce();
      const [, patch] = txUpdateMock.mock.calls[0];
      expect(patch.status).toBe('awaiting_payment');
      expect(patch.verificationId).toBe('agechecker-xyz');
      expect(patch.ageVerifiedAt).toEqual(verifiedAt);
      expect(patch.updatedAt).toBeInstanceOf(Date);
      expect(result.status).toBe('awaiting_payment');
    });

    it('throws InvalidCheckoutSessionTransitionError when current status is completed', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('completed'));
      await expect(
        markAgeVerified('clover-sess-abc', 'v', new Date())
      ).rejects.toThrow(InvalidCheckoutSessionTransitionError);
      expect(txUpdateMock).not.toHaveBeenCalled();
    });

    it('throws when session does not exist', async () => {
      txGetMock.mockResolvedValueOnce({ exists: false });
      await expect(
        markAgeVerified('missing', 'v', new Date())
      ).rejects.toThrow(/not found/);
    });
  });

  describe('markCheckoutSessionCompleted', () => {
    it('transitions awaiting_payment → completed and stamps orderId', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_payment'));
      const result = await markCheckoutSessionCompleted(
        'clover-sess-abc',
        'order-123'
      );
      const [, patch] = txUpdateMock.mock.calls[0];
      expect(patch.status).toBe('completed');
      expect(patch.orderId).toBe('order-123');
      expect(result.status).toBe('completed');
    });

    it('rejects illegal direct awaiting_id → completed transition', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_id'));
      await expect(
        markCheckoutSessionCompleted('clover-sess-abc', 'order-123')
      ).rejects.toThrow(InvalidCheckoutSessionTransitionError);
    });
  });

  describe('markCheckoutSessionExpired', () => {
    it('transitions awaiting_id → expired', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_id'));
      const result = await markCheckoutSessionExpired('clover-sess-abc');
      expect(result.status).toBe('expired');
    });

    it('refuses to expire an already-completed session', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('completed'));
      await expect(
        markCheckoutSessionExpired('clover-sess-abc')
      ).rejects.toThrow(InvalidCheckoutSessionTransitionError);
    });
  });

  describe('markCheckoutSessionCancelled', () => {
    it('transitions awaiting_payment → cancelled', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_payment'));
      const result = await markCheckoutSessionCancelled('clover-sess-abc');
      expect(result.status).toBe('cancelled');
    });
  });

  describe('terminal states', () => {
    it.each<CheckoutSessionStatus>(['completed', 'cancelled', 'expired'])(
      'rejects any transition out of %s',
      async terminal => {
        txGetMock.mockResolvedValueOnce(makeSnap(terminal));
        await expect(
          markCheckoutSessionCancelled('clover-sess-abc')
        ).rejects.toThrow(InvalidCheckoutSessionTransitionError);
      }
    );
  });

  // Type-level smoke check ensures the satisfies clause keeps shape parity
  // with the CheckoutSession contract.
  it('hydrated session matches CheckoutSession type', async () => {
    docGetMock.mockResolvedValueOnce(makeSnap('awaiting_id'));
    const s = (await getCheckoutSession('clover-sess-abc')) as CheckoutSession;
    expect(s.cloverCheckoutSessionId).toBe('clover-sess-abc');
  });
});
