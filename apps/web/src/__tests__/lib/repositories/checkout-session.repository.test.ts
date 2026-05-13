import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeDocSnap {
  exists: boolean;
  id: string;
  data: () => FirebaseFirestore.DocumentData;
}

const {
  docGetMock,
  docSetMock,
  docCreateMock,
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
  const docCreateMock = vi.fn().mockResolvedValue(undefined);
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
    create: docCreateMock,
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
    docCreateMock,
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
  DuplicateCheckoutSessionError,
  getCheckoutSession,
  InvalidCheckoutSessionTransitionError,
  markAgeVerified,
  markCheckoutSessionCancelled,
  markCheckoutSessionCompleted,
  markCheckoutSessionInFlight,
  markCheckoutSessionExpired,
  setAgeCheckerSessionId,
} from '@/lib/repositories/checkout-session.repository';
import type {
  CheckoutSession,
  CheckoutSessionStatus,
} from '@/types/checkout-session';

// The doc id is a string WE generate; Clover's own id is a stored field.
// Keep them deliberately different so a mix-up is caught.
const OUR_SESSION_ID = 'cs_abc';
const CLOVER_SESSION_ID = 'clover-sess-xyz';

const baseInput = {
  id: OUR_SESSION_ID,
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
  cloverCheckoutSessionId: CLOVER_SESSION_ID,
  expiresAt: new Date('2026-06-01T00:00:00Z'),
};

function makeSnap(
  status: CheckoutSessionStatus,
  extra: Record<string, unknown> = {}
): FakeDocSnap {
  return {
    exists: true,
    id: OUR_SESSION_ID,
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
    it('uses our generated id as the document id, stores cloverCheckoutSessionId as a field, and writes status=awaiting_id', async () => {
      const id = await createCheckoutSession(baseInput);

      expect(id).toBe(OUR_SESSION_ID);
      expect(collectionMock).toHaveBeenCalledWith('checkout-sessions');
      expect(docFnMock).toHaveBeenCalledWith(OUR_SESSION_ID);
      expect(docCreateMock).toHaveBeenCalledOnce();

      const [payload] = docCreateMock.mock.calls[0];
      expect(payload.status).toBe('awaiting_id');
      expect(payload.cloverCheckoutSessionId).toBe(CLOVER_SESSION_ID);
      expect(payload.ageVerifiedAt).toBeNull();
      expect(payload.verificationId).toBeNull();
      expect(payload.ageCheckerSessionId).toBeNull();
      expect(payload.createdAt).toBeInstanceOf(Date);
      expect(payload.updatedAt).toBeInstanceOf(Date);
      expect(payload.expiresAt).toEqual(baseInput.expiresAt);
      expect(payload.holds).toHaveLength(1);
    });

    it('throws when id is missing', async () => {
      await expect(
        createCheckoutSession({ ...baseInput, id: '' })
      ).rejects.toThrow(/id is required/);
      expect(docCreateMock).not.toHaveBeenCalled();
    });

    it('throws when cloverCheckoutSessionId is missing', async () => {
      await expect(
        createCheckoutSession({ ...baseInput, cloverCheckoutSessionId: '' })
      ).rejects.toThrow(/cloverCheckoutSessionId/);
      expect(docCreateMock).not.toHaveBeenCalled();
    });

    it('omits customerEmail from payload when not provided', async () => {
      await createCheckoutSession(baseInput);
      const [payload] = docCreateMock.mock.calls[0];
      expect('customerEmail' in payload).toBe(false);
    });

    it('includes customerEmail when provided', async () => {
      await createCheckoutSession({
        ...baseInput,
        customerEmail: 'b@example.com',
      });
      const [payload] = docCreateMock.mock.calls[0];
      expect(payload.customerEmail).toBe('b@example.com');
    });

    it('throws DuplicateCheckoutSessionError when Clover session id already exists (numeric code 6)', async () => {
      docCreateMock.mockRejectedValueOnce(
        Object.assign(new Error('ALREADY_EXISTS'), { code: 6 })
      );
      await expect(createCheckoutSession(baseInput)).rejects.toBeInstanceOf(
        DuplicateCheckoutSessionError
      );
    });

    it('throws DuplicateCheckoutSessionError when Clover session id already exists (string code)', async () => {
      docCreateMock.mockRejectedValueOnce(
        Object.assign(new Error('ALREADY_EXISTS'), { code: 'already-exists' })
      );
      await expect(createCheckoutSession(baseInput)).rejects.toBeInstanceOf(
        DuplicateCheckoutSessionError
      );
    });

    it('rethrows non-duplicate errors from create()', async () => {
      const oops = new Error('network');
      docCreateMock.mockRejectedValueOnce(oops);
      await expect(createCheckoutSession(baseInput)).rejects.toBe(oops);
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
      const session = await getCheckoutSession(OUR_SESSION_ID);
      expect(session).not.toBeNull();
      expect(session!.id).toBe(OUR_SESSION_ID);
      expect(session!.status).toBe('awaiting_id');
      expect(session!.ageVerifiedAt).toBeNull();
      expect(session!.verificationId).toBeNull();
      expect(session!.ageCheckerSessionId).toBeNull();
      expect(session!.holds).toHaveLength(1);
      expect(session!.holds[0].variantId).toBe('default');
    });
  });

  describe('markAgeVerified', () => {
    it('transitions awaiting_id → awaiting_payment and stamps verification fields', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_id'));
      const verifiedAt = new Date('2026-05-02T12:00:00Z');

      const result = await markAgeVerified(
        OUR_SESSION_ID,
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
        markAgeVerified(OUR_SESSION_ID, 'v', new Date())
      ).rejects.toThrow(InvalidCheckoutSessionTransitionError);
      expect(txUpdateMock).not.toHaveBeenCalled();
    });

    it('throws when session does not exist', async () => {
      txGetMock.mockResolvedValueOnce({ exists: false });
      await expect(markAgeVerified('missing', 'v', new Date())).rejects.toThrow(
        /not found/
      );
    });
  });

  describe('markCheckoutSessionInFlight (#405)', () => {
    it('atomically claims awaiting_payment → in_flight', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_payment'));
      const result = await markCheckoutSessionInFlight(OUR_SESSION_ID);
      const [, patch] = txUpdateMock.mock.calls[0];
      expect(patch.status).toBe('in_flight');
      expect(result.status).toBe('in_flight');
    });

    it('rejects a second concurrent claim (in_flight is not a legal source)', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('in_flight'));
      await expect(markCheckoutSessionInFlight(OUR_SESSION_ID)).rejects.toThrow(
        InvalidCheckoutSessionTransitionError
      );
    });

    it('rejects claim from awaiting_id (must verify ID first)', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_id'));
      await expect(markCheckoutSessionInFlight(OUR_SESSION_ID)).rejects.toThrow(
        InvalidCheckoutSessionTransitionError
      );
    });
  });

  describe('markCheckoutSessionCompleted', () => {
    it('transitions in_flight → completed and stamps orderId (#405)', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('in_flight'));
      const result = await markCheckoutSessionCompleted(
        OUR_SESSION_ID,
        'order-123'
      );
      const [, patch] = txUpdateMock.mock.calls[0];
      expect(patch.status).toBe('completed');
      expect(patch.orderId).toBe('order-123');
      expect(result.status).toBe('completed');
    });

    it('rejects illegal direct awaiting_payment → completed transition (#405)', async () => {
      // Post-#405 the only path to `completed` is via `in_flight` so the
      // race-claim is the only place an Order id is minted.
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_payment'));
      await expect(
        markCheckoutSessionCompleted(OUR_SESSION_ID, 'order-123')
      ).rejects.toThrow(InvalidCheckoutSessionTransitionError);
    });

    it('rejects illegal direct awaiting_id → completed transition', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_id'));
      await expect(
        markCheckoutSessionCompleted(OUR_SESSION_ID, 'order-123')
      ).rejects.toThrow(InvalidCheckoutSessionTransitionError);
    });
  });

  describe('markCheckoutSessionExpired', () => {
    it('transitions awaiting_id → expired', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_id'));
      const result = await markCheckoutSessionExpired(OUR_SESSION_ID);
      expect(result.status).toBe('expired');
    });

    it('refuses to expire an already-completed session', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('completed'));
      await expect(markCheckoutSessionExpired(OUR_SESSION_ID)).rejects.toThrow(
        InvalidCheckoutSessionTransitionError
      );
    });
  });

  describe('markCheckoutSessionCancelled', () => {
    it('transitions awaiting_payment → cancelled', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('awaiting_payment'));
      const result = await markCheckoutSessionCancelled(OUR_SESSION_ID);
      expect(result.status).toBe('cancelled');
    });

    it('transitions in_flight → cancelled (compensation path, #405)', async () => {
      txGetMock.mockResolvedValueOnce(makeSnap('in_flight'));
      const result = await markCheckoutSessionCancelled(OUR_SESSION_ID);
      expect(result.status).toBe('cancelled');
    });
  });

  describe('setAgeCheckerSessionId', () => {
    it('writes the field when currently null', async () => {
      txGetMock.mockResolvedValueOnce(
        makeSnap('awaiting_id', { ageCheckerSessionId: null })
      );
      await setAgeCheckerSessionId(OUR_SESSION_ID, 'ac-uuid-new');
      expect(txUpdateMock).toHaveBeenCalledOnce();
      const [, patch] = txUpdateMock.mock.calls[0];
      expect(patch.ageCheckerSessionId).toBe('ac-uuid-new');
      expect(patch.updatedAt).toBeInstanceOf(Date);
    });

    it('is idempotent — does not overwrite when already set', async () => {
      txGetMock.mockResolvedValueOnce(
        makeSnap('awaiting_id', { ageCheckerSessionId: 'ac-existing' })
      );
      await setAgeCheckerSessionId(OUR_SESSION_ID, 'ac-new');
      expect(txUpdateMock).not.toHaveBeenCalled();
    });

    it('throws when sessionId not found', async () => {
      txGetMock.mockResolvedValueOnce({ exists: false });
      await expect(setAgeCheckerSessionId('missing', 'ac-x')).rejects.toThrow(
        /not found/
      );
    });

    it('throws when ageCheckerSessionId arg is empty', async () => {
      await expect(setAgeCheckerSessionId(OUR_SESSION_ID, '')).rejects.toThrow(
        /required/
      );
    });
  });

  describe('terminal states', () => {
    it.each<CheckoutSessionStatus>(['completed', 'cancelled', 'expired'])(
      'rejects any transition out of %s',
      async terminal => {
        txGetMock.mockResolvedValueOnce(makeSnap(terminal));
        await expect(
          markCheckoutSessionCancelled(OUR_SESSION_ID)
        ).rejects.toThrow(InvalidCheckoutSessionTransitionError);
      }
    );
  });

  // Type-level smoke check ensures the satisfies clause keeps shape parity
  // with the CheckoutSession contract.
  it('hydrated session matches CheckoutSession type', async () => {
    docGetMock.mockResolvedValueOnce(makeSnap('awaiting_id'));
    const s = (await getCheckoutSession(OUR_SESSION_ID)) as CheckoutSession;
    expect(s.id).toBe(OUR_SESSION_ID);
    expect(s.cloverCheckoutSessionId).toBe(CLOVER_SESSION_ID);
  });
});
