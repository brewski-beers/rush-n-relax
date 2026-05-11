/**
 * BDD coverage for `finalizeCheckoutSession` (#368).
 *
 * The finalizer is the heart of the money-path: it turns a paid Clover
 * CheckoutSession into a real Order. Coverage is organized around the
 * four ticket acceptance scenarios.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutSession } from '@/types/checkout-session';

const mocks = vi.hoisted(() => ({
  getCheckoutSession: vi.fn(),
  createOrder: vi.fn(),
  commitStock: vi.fn(),
  markCheckoutSessionInFlight: vi.fn(),
  markCheckoutSessionCompleted: vi.fn(),
  markCheckoutSessionCancelled: vi.fn(),
  transitionStatus: vi.fn(),
  enqueueRefundPending: vi.fn(),
  getCloverPaymentForOrder: vi.fn(),
  refundCloverPayment: vi.fn(),
  isLivePaymentsEnabled: vi.fn(),
}));

vi.mock('@/lib/repositories', async () => {
  // Use the real InvalidCheckoutSessionTransitionError so `instanceof`
  // checks inside finalize.ts (#405 race-claim path) work as expected.
  const actual =
    await vi.importActual<typeof import('@/lib/repositories')>(
      '@/lib/repositories'
    );
  return {
    getCheckoutSession: mocks.getCheckoutSession,
    createOrder: mocks.createOrder,
    commitStock: mocks.commitStock,
    markCheckoutSessionInFlight: mocks.markCheckoutSessionInFlight,
    markCheckoutSessionCompleted: mocks.markCheckoutSessionCompleted,
    markCheckoutSessionCancelled: mocks.markCheckoutSessionCancelled,
    transitionStatus: mocks.transitionStatus,
    enqueueRefundPending: mocks.enqueueRefundPending,
    InvalidCheckoutSessionTransitionError:
      actual.InvalidCheckoutSessionTransitionError,
  };
});

vi.mock('@/lib/clover/checkout', async () => {
  const actual = await vi.importActual<typeof import('@/lib/clover/checkout')>(
    '@/lib/clover/checkout'
  );
  return {
    ...actual,
    getCloverPaymentForOrder: mocks.getCloverPaymentForOrder,
    refundCloverPayment: mocks.refundCloverPayment,
  };
});

vi.mock('@/lib/test-mode', () => ({
  isLivePaymentsEnabled: mocks.isLivePaymentsEnabled,
}));

import { finalizeCheckoutSession } from '@/lib/checkout/finalize';

function makeSession(
  overrides: Partial<CheckoutSession> = {}
): CheckoutSession {
  return {
    id: 'clover-sess-1',
    items: [
      {
        productId: 'p1',
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
    customerEmail: 'b@example.com',
    status: 'awaiting_payment',
    ageVerifiedAt: new Date('2026-05-01T00:00:00Z'),
    verificationId: 'agechecker-x',
    ageCheckerSessionId: 'ac-uuid-x',
    holds: [
      { productId: 'p1', variantId: 'default', locationId: 'online', qty: 2 },
    ],
    cloverCheckoutSessionId: 'clover-sess-1',
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    expiresAt: new Date('2026-05-02T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset();
  mocks.isLivePaymentsEnabled.mockReturnValue(true);
  mocks.markCheckoutSessionInFlight.mockResolvedValue(undefined);
  mocks.markCheckoutSessionCompleted.mockResolvedValue(undefined);
  mocks.markCheckoutSessionCancelled.mockResolvedValue(undefined);
  mocks.transitionStatus.mockResolvedValue(undefined);
  mocks.refundCloverPayment.mockResolvedValue({ refundId: 'r-1' });
  mocks.enqueueRefundPending.mockResolvedValue(undefined);
});

describe('finalizeCheckoutSession (#368)', () => {
  describe('paid → order created with status paid', () => {
    it('creates an order, commits stock, marks session completed', async () => {
      mocks.getCheckoutSession.mockResolvedValue(makeSession());
      mocks.getCloverPaymentForOrder.mockResolvedValue({
        result: 'SUCCESS',
        paymentId: 'pay-123',
      });
      mocks.createOrder.mockResolvedValue('ord-1');
      mocks.commitStock.mockResolvedValue(undefined);

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
        cloverOrderId: 'clover-ord-1',
      });

      expect(out).toEqual({ kind: 'paid', orderId: 'ord-1' });

      const [orderArg] = mocks.createOrder.mock.calls[0];
      expect(orderArg.status).toBe('paid');
      expect(orderArg.cloverPaymentId).toBe('pay-123');
      expect(orderArg.cloverCheckoutSessionId).toBe('clover-sess-1');
      expect(orderArg.items).toHaveLength(1);

      expect(mocks.commitStock).toHaveBeenCalledOnce();
      expect(mocks.markCheckoutSessionCompleted).toHaveBeenCalledWith(
        'clover-sess-1',
        'ord-1'
      );
    });
  });

  describe('declined / unpaid → no order created, session left awaiting', () => {
    it('returns awaiting when Clover reports PENDING', async () => {
      mocks.getCheckoutSession.mockResolvedValue(makeSession());
      mocks.getCloverPaymentForOrder.mockResolvedValue({ result: 'PENDING' });

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
        cloverOrderId: 'clover-ord-1',
      });

      expect(out.kind).toBe('awaiting');
      expect(mocks.createOrder).not.toHaveBeenCalled();
      expect(mocks.commitStock).not.toHaveBeenCalled();
      expect(mocks.markCheckoutSessionCompleted).not.toHaveBeenCalled();
    });

    it('cancels the session (no order) when Clover reports FAIL', async () => {
      mocks.getCheckoutSession.mockResolvedValue(makeSession());
      mocks.getCloverPaymentForOrder.mockResolvedValue({ result: 'FAIL' });

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
        cloverOrderId: 'clover-ord-1',
      });

      expect(out.kind).toBe('declined');
      expect(mocks.createOrder).not.toHaveBeenCalled();
      expect(mocks.markCheckoutSessionCancelled).toHaveBeenCalledWith(
        'clover-sess-1'
      );
    });

    it('returns awaiting when no Clover orderId is supplied (live mode)', async () => {
      mocks.getCheckoutSession.mockResolvedValue(makeSession());
      mocks.isLivePaymentsEnabled.mockReturnValue(true);

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
      });

      expect(out.kind).toBe('awaiting');
      expect(mocks.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('already-completed session → render existing order (idempotent)', () => {
    it('short-circuits without creating a second order', async () => {
      mocks.getCheckoutSession.mockResolvedValue(
        makeSession({ status: 'completed', orderId: 'ord-existing' })
      );

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
        cloverOrderId: 'clover-ord-1',
      });

      expect(out).toEqual({
        kind: 'already-completed',
        orderId: 'ord-existing',
      });
      expect(mocks.createOrder).not.toHaveBeenCalled();
      expect(mocks.commitStock).not.toHaveBeenCalled();
      expect(mocks.getCloverPaymentForOrder).not.toHaveBeenCalled();
    });
  });

  describe('commit failure → refund + cancellation path', () => {
    it('refunds the Clover payment, cancels the order, and cancels the session', async () => {
      mocks.getCheckoutSession.mockResolvedValue(makeSession());
      mocks.getCloverPaymentForOrder.mockResolvedValue({
        result: 'SUCCESS',
        paymentId: 'pay-XYZ',
      });
      mocks.createOrder.mockResolvedValue('ord-2');
      mocks.commitStock.mockRejectedValue(new Error('insufficient stock'));

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
        cloverOrderId: 'clover-ord-1',
      });

      expect(out).toEqual({
        kind: 'commit-failed',
        sessionId: 'clover-sess-1',
        orderId: 'ord-2',
      });
      expect(mocks.refundCloverPayment).toHaveBeenCalledWith('pay-XYZ');
      expect(mocks.transitionStatus).toHaveBeenCalledWith(
        'ord-2',
        'cancelled',
        'system',
        expect.objectContaining({
          reason: expect.stringContaining('commit-stock failed'),
        })
      );
      expect(mocks.markCheckoutSessionCancelled).toHaveBeenCalledWith(
        'clover-sess-1'
      );
      // Session was NOT marked completed.
      expect(mocks.markCheckoutSessionCompleted).not.toHaveBeenCalled();
    });

    it('still cancels statuses even if the refund call fails (loud log, no throw)', async () => {
      mocks.getCheckoutSession.mockResolvedValue(makeSession());
      mocks.getCloverPaymentForOrder.mockResolvedValue({
        result: 'SUCCESS',
        paymentId: 'pay-XYZ',
      });
      mocks.createOrder.mockResolvedValue('ord-2');
      mocks.commitStock.mockRejectedValue(new Error('boom'));
      mocks.refundCloverPayment.mockRejectedValue(new Error('clover 500'));
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
        cloverOrderId: 'clover-ord-1',
      });

      expect(out.kind).toBe('commit-failed');
      expect(errSpy).toHaveBeenCalled();
      expect(mocks.transitionStatus).toHaveBeenCalled();
      expect(mocks.markCheckoutSessionCancelled).toHaveBeenCalled();
    });

    it('enqueues a refund-pending row when the refund call fails (#406)', async () => {
      mocks.getCheckoutSession.mockResolvedValue(makeSession());
      mocks.getCloverPaymentForOrder.mockResolvedValue({
        result: 'SUCCESS',
        paymentId: 'pay-QUEUE',
      });
      mocks.createOrder.mockResolvedValue('ord-q');
      mocks.commitStock.mockRejectedValue(new Error('insufficient'));
      mocks.refundCloverPayment.mockRejectedValue(new Error('clover 503'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
        cloverOrderId: 'clover-ord-1',
      });

      expect(out.kind).toBe('commit-failed');
      expect(mocks.enqueueRefundPending).toHaveBeenCalledOnce();
      const [arg] = mocks.enqueueRefundPending.mock.calls[0];
      expect(arg).toEqual(
        expect.objectContaining({
          cloverPaymentId: 'pay-QUEUE',
          orderId: 'ord-q',
          sessionId: 'clover-sess-1',
          createdBy: 'finalize',
        })
      );
      expect(typeof arg.error).toBe('string');
      expect(arg.error.length).toBeGreaterThan(0);
    });

    it('does NOT enqueue a refund-pending row when the refund succeeds (#406)', async () => {
      mocks.getCheckoutSession.mockResolvedValue(makeSession());
      mocks.getCloverPaymentForOrder.mockResolvedValue({
        result: 'SUCCESS',
        paymentId: 'pay-OK',
      });
      mocks.createOrder.mockResolvedValue('ord-ok');
      mocks.commitStock.mockRejectedValue(new Error('boom'));
      // refundCloverPayment resolves by default (beforeEach).

      await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
        cloverOrderId: 'clover-ord-1',
      });

      expect(mocks.enqueueRefundPending).not.toHaveBeenCalled();
    });
  });

  describe('test-mode fallback (live payments off)', () => {
    it('promotes to paid even without a Clover orderId when kill switch is OFF', async () => {
      mocks.isLivePaymentsEnabled.mockReturnValue(false);
      mocks.getCheckoutSession.mockResolvedValue(makeSession());
      mocks.createOrder.mockResolvedValue('ord-stub');
      mocks.commitStock.mockResolvedValue(undefined);

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
      });

      expect(out).toEqual({ kind: 'paid', orderId: 'ord-stub' });
      const [orderArg] = mocks.createOrder.mock.calls[0];
      // No Clover paymentId in stub mode — must not write the field.
      expect(orderArg.cloverPaymentId).toBeUndefined();
    });
  });

  describe('concurrent promotion → race-safe claim (#405)', () => {
    it('losing caller returns already-completed once winner finishes', async () => {
      // Winner has already flipped session → completed and stamped orderId.
      // The claim transaction throws InvalidCheckoutSessionTransitionError
      // (in_flight is not a legal source for awaiting_payment → in_flight).
      const { InvalidCheckoutSessionTransitionError } =
        await vi.importActual<typeof import('@/lib/repositories')>(
          '@/lib/repositories'
        );
      mocks.getCheckoutSession
        // First read: still appears awaiting_payment to this caller.
        .mockResolvedValueOnce(makeSession())
        // Second read (after claim throws): winner has finished.
        .mockResolvedValueOnce(
          makeSession({ status: 'completed', orderId: 'ord-winner' })
        );
      mocks.getCloverPaymentForOrder.mockResolvedValue({
        result: 'SUCCESS',
        paymentId: 'pay-loser',
      });
      mocks.markCheckoutSessionInFlight.mockRejectedValue(
        new InvalidCheckoutSessionTransitionError('in_flight', 'in_flight')
      );

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
        cloverOrderId: 'clover-ord-1',
      });

      expect(out).toEqual({
        kind: 'already-completed',
        orderId: 'ord-winner',
      });
      // Crucially: loser must NOT createOrder or commitStock.
      expect(mocks.createOrder).not.toHaveBeenCalled();
      expect(mocks.commitStock).not.toHaveBeenCalled();
    });

    it('losing caller returns awaiting while winner is still in_flight', async () => {
      const { InvalidCheckoutSessionTransitionError } =
        await vi.importActual<typeof import('@/lib/repositories')>(
          '@/lib/repositories'
        );
      mocks.getCheckoutSession
        .mockResolvedValueOnce(makeSession())
        .mockResolvedValueOnce(makeSession({ status: 'in_flight' }));
      mocks.getCloverPaymentForOrder.mockResolvedValue({
        result: 'SUCCESS',
        paymentId: 'pay-loser',
      });
      mocks.markCheckoutSessionInFlight.mockRejectedValue(
        new InvalidCheckoutSessionTransitionError('in_flight', 'in_flight')
      );

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
        cloverOrderId: 'clover-ord-1',
      });

      expect(out.kind).toBe('awaiting');
      expect(mocks.createOrder).not.toHaveBeenCalled();
      expect(mocks.commitStock).not.toHaveBeenCalled();
    });

    it('losing caller returns declined when winner cancelled (commit failed)', async () => {
      const { InvalidCheckoutSessionTransitionError } =
        await vi.importActual<typeof import('@/lib/repositories')>(
          '@/lib/repositories'
        );
      mocks.getCheckoutSession
        .mockResolvedValueOnce(makeSession())
        .mockResolvedValueOnce(makeSession({ status: 'cancelled' }));
      mocks.getCloverPaymentForOrder.mockResolvedValue({
        result: 'SUCCESS',
        paymentId: 'pay-loser',
      });
      mocks.markCheckoutSessionInFlight.mockRejectedValue(
        new InvalidCheckoutSessionTransitionError('in_flight', 'in_flight')
      );

      const out = await finalizeCheckoutSession({
        cloverCheckoutSessionId: 'clover-sess-1',
        cloverOrderId: 'clover-ord-1',
      });

      expect(out.kind).toBe('declined');
      expect(mocks.createOrder).not.toHaveBeenCalled();
    });

    it('Promise.all([finalize, finalize]) yields exactly one Order + one stock commit', async () => {
      // Simulate the real race: both callers see `awaiting_payment` on
      // initial read; only one wins the in-flight claim.
      const { InvalidCheckoutSessionTransitionError } =
        await vi.importActual<typeof import('@/lib/repositories')>(
          '@/lib/repositories'
        );
      mocks.getCheckoutSession.mockImplementation(async () =>
        makeSession({ status: 'awaiting_payment' })
      );
      mocks.getCloverPaymentForOrder.mockResolvedValue({
        result: 'SUCCESS',
        paymentId: 'pay-race',
      });
      mocks.createOrder.mockResolvedValue('ord-race');
      mocks.commitStock.mockResolvedValue(undefined);

      let claims = 0;
      let winnerOrderId: string | undefined;
      mocks.markCheckoutSessionInFlight.mockImplementation(async () => {
        claims += 1;
        if (claims === 1) return undefined; // winner
        throw new InvalidCheckoutSessionTransitionError(
          'in_flight',
          'in_flight'
        );
      });
      mocks.markCheckoutSessionCompleted.mockImplementation(
        async (_id, oid) => {
          winnerOrderId = oid;
        }
      );
      // Loser's second-read sees the winner's completed state.
      // We cannot know order; have getCheckoutSession's second invocation
      // for the loser return completed. Use a counter on getCheckoutSession.
      let reads = 0;
      mocks.getCheckoutSession.mockImplementation(async () => {
        reads += 1;
        // Reads 1 and 2 are the initial reads of both callers.
        if (reads <= 2) return makeSession({ status: 'awaiting_payment' });
        return makeSession({
          status: 'completed',
          orderId: winnerOrderId ?? 'ord-race',
        });
      });

      const [a, b] = await Promise.all([
        finalizeCheckoutSession({
          cloverCheckoutSessionId: 'clover-sess-1',
          cloverOrderId: 'clover-ord-1',
        }),
        finalizeCheckoutSession({
          cloverCheckoutSessionId: 'clover-sess-1',
          cloverOrderId: 'clover-ord-1',
        }),
      ]);

      const kinds = [a.kind, b.kind].sort();
      expect(kinds).toEqual(['already-completed', 'paid']);
      expect(mocks.createOrder).toHaveBeenCalledOnce();
      expect(mocks.commitStock).toHaveBeenCalledOnce();
    });
  });

  describe('unknown session', () => {
    it('throws a clear error so the route can redirect home', async () => {
      mocks.getCheckoutSession.mockResolvedValue(null);

      await expect(
        finalizeCheckoutSession({ cloverCheckoutSessionId: 'nope' })
      ).rejects.toThrow(/not found/);
    });
  });
});
