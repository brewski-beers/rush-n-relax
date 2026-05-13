import { describe, it, expect, vi } from 'vitest';
import {
  reconcileCheckoutSessionsImpl,
  type ReconcilerDeps,
  type ReconcileSession,
  type ReconcileOrder,
  type CloverCheckoutLookup,
  type RefundPendingRow,
  SETTLE_WINDOW_MS,
  REFUND_RETRY_MAX,
} from './reconciler';

/**
 * BDD coverage for the dual-direction CheckoutSession reconciler (#369 + #407).
 *
 * The reconciler is structured as pure orchestration over an injected
 * dependency surface. Tests stub each adapter and assert the high-level
 * decisions (promote / expire / cancel / pending / repair / conflict).
 */

const NOW_MS = Date.UTC(2026, 4, 6, 12, 0, 0);

function makeSession(
  overrides: Partial<ReconcileSession> = {}
): ReconcileSession {
  return {
    // Doc id (the `cs_…` string we generate) vs Clover's own checkout id —
    // deliberately different so a mix-up is caught.
    id: 'sess_1',
    status: 'awaiting_payment',
    cloverCheckoutSessionId: 'clover_1',
    holds: [
      { productId: 'p1', variantId: 'default', locationId: 'online', qty: 1 },
    ],
    createdAt: new Date(NOW_MS - 30 * 60 * 1000),
    expiresAt: new Date(NOW_MS + 60 * 60 * 1000),
    total: 3270,
    customerEmail: 'buyer@example.com',
    ...overrides,
  };
}

function makeDeps(overrides: Partial<ReconcilerDeps> = {}): ReconcilerDeps {
  return {
    listStaleSessions: vi.fn(async () => []),
    listRecentOrdersWithCheckoutSession: vi.fn(async () => []),
    getSession: vi.fn(async () => null),
    lookupCloverCheckout: vi.fn(async () => null),
    triggerStorefrontPromotion: vi.fn(async () => true),
    expireSessionAndReleaseHolds: vi.fn(async () => undefined),
    cancelSessionAndReleaseHolds: vi.fn(async () => undefined),
    repairSessionBackPointer: vi.fn(async () => ({ repaired: true })),
    listRefundsPendingForRetry: vi.fn(async () => []),
    retryCloverRefund: vi.fn(async () => undefined),
    deleteRefundPending: vi.fn(async () => undefined),
    markRefundPendingRetryFailed: vi.fn(async () => undefined),
    log: vi.fn(),
    ...overrides,
  };
}

describe('reconcileCheckoutSessionsImpl — forward repair (#369)', () => {
  it('Given a stale session with a Clover SUCCESS payment, When the cron runs, Then it triggers the storefront promotion (by session DOC id) and counts it', async () => {
    const session = makeSession();
    const triggerStorefrontPromotion = vi.fn(async () => true);
    const lookupCloverCheckout = vi.fn(
      async (): Promise<CloverCheckoutLookup> => ({
        result: 'SUCCESS',
        cloverOrderId: 'ord_clover_1',
      })
    );
    const deps = makeDeps({
      listStaleSessions: vi.fn(async () => [session]),
      lookupCloverCheckout,
      triggerStorefrontPromotion,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    // The /order/{id}/return route resolves the session by its doc id, so
    // we pass `session.id` ('sess_1') — NOT `session.cloverCheckoutSessionId`.
    expect(triggerStorefrontPromotion).toHaveBeenCalledWith(
      'sess_1',
      'ord_clover_1'
    );
    // The Clover lookup receives the full session context — the underlying
    // waterfall needs all of (cloverCheckoutSessionId, sessionId, total,
    // customerEmail, createdAt) to fall back from /checkouts/{id} to the
    // tagged + heuristic orders-list lookups.
    expect(lookupCloverCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sess_1',
        cloverCheckoutSessionId: 'clover_1',
      })
    );
    expect(result.promoted).toBe(1);
    expect(result.scanned).toBe(1);
    expect(result.errors).toBe(0);
  });

  it('Given a stale session whose Clover payment FAILED, When the cron runs, Then it cancels and releases holds', async () => {
    const session = makeSession();
    const cancelSessionAndReleaseHolds = vi.fn(async () => undefined);
    const deps = makeDeps({
      listStaleSessions: vi.fn(async () => [session]),
      lookupCloverCheckout: vi.fn(
        async (): Promise<CloverCheckoutLookup> => ({ result: 'FAIL' })
      ),
      cancelSessionAndReleaseHolds,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(cancelSessionAndReleaseHolds).toHaveBeenCalledWith(session);
    expect(result.declined).toBe(1);
  });

  it('Given a stale session whose Clover payment is PENDING, When the cron runs, Then it leaves the session alone for the next tick', async () => {
    const session = makeSession();
    const triggerStorefrontPromotion = vi.fn(async () => true);
    const deps = makeDeps({
      listStaleSessions: vi.fn(async () => [session]),
      lookupCloverCheckout: vi.fn(
        async (): Promise<CloverCheckoutLookup> => ({ result: 'PENDING' })
      ),
      triggerStorefrontPromotion,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(triggerStorefrontPromotion).not.toHaveBeenCalled();
    expect(result.pending).toBe(1);
    expect(result.promoted).toBe(0);
  });

  it('Given an expired session with no resolvable Clover payment, When the cron runs, Then it checks Clover FIRST and only then expires + releases holds (#audit B3)', async () => {
    const session = makeSession({
      expiresAt: new Date(NOW_MS - 1000),
    });
    const expireSessionAndReleaseHolds = vi.fn(async () => undefined);
    const lookupCloverCheckout = vi.fn(
      async (): Promise<CloverCheckoutLookup> => ({ result: 'PENDING' })
    );
    const deps = makeDeps({
      listStaleSessions: vi.fn(async () => [session]),
      expireSessionAndReleaseHolds,
      lookupCloverCheckout,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    // Payment status is checked before expiry now — only because there is
    // no resolvable payment do we go ahead and expire.
    expect(lookupCloverCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ id: session.id })
    );
    expect(expireSessionAndReleaseHolds).toHaveBeenCalledWith(session);
    expect(result.expired).toBe(1);
  });

  it('Given an expired session that nonetheless has a Clover SUCCESS payment, When the cron runs, Then it promotes the order rather than expiring (#audit B3 — payment wins over expiry)', async () => {
    const session = makeSession({
      expiresAt: new Date(NOW_MS - 1000),
    });
    const expireSessionAndReleaseHolds = vi.fn(async () => undefined);
    const triggerStorefrontPromotion = vi.fn(async () => true);
    const deps = makeDeps({
      listStaleSessions: vi.fn(async () => [session]),
      expireSessionAndReleaseHolds,
      triggerStorefrontPromotion,
      lookupCloverCheckout: vi.fn(
        async (): Promise<CloverCheckoutLookup> => ({
          result: 'SUCCESS',
          cloverOrderId: 'ord_clover_late',
        })
      ),
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(triggerStorefrontPromotion).toHaveBeenCalledWith(
      'sess_1',
      'ord_clover_late'
    );
    expect(expireSessionAndReleaseHolds).not.toHaveBeenCalled();
    expect(result.promoted).toBe(1);
    expect(result.expired).toBe(0);
  });

  it('uses SETTLE_WINDOW_MS to compute the staleBefore boundary passed to listStaleSessions', async () => {
    const listStaleSessions = vi.fn(async () => []);
    const deps = makeDeps({ listStaleSessions });

    await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    const arg = listStaleSessions.mock.calls[0][0] as Date;
    expect(arg.getTime()).toBe(NOW_MS - SETTLE_WINDOW_MS);
  });

  it('skips sessions whose status raced into a terminal state since the query', async () => {
    const session = makeSession({ status: 'completed' });
    const lookupCloverCheckout = vi.fn();
    const deps = makeDeps({
      listStaleSessions: vi.fn(async () => [session]),
      lookupCloverCheckout,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(lookupCloverCheckout).not.toHaveBeenCalled();
    expect(result.scanned).toBe(1);
    expect(result.promoted).toBe(0);
  });
});

describe('reconcileCheckoutSessionsImpl — back-pointer repair (#407)', () => {
  it('Given a paid order whose linked session has no orderId, When the cron runs, Then it patches the session pointer', async () => {
    const order: ReconcileOrder = {
      id: 'ord_1',
      checkoutSessionId: 'sess_1',
      status: 'paid',
      createdAt: new Date(NOW_MS - 60 * 1000),
    };
    const session = makeSession({
      status: 'awaiting_payment',
      orderId: undefined,
    });
    const repairSessionBackPointer = vi.fn(async () => ({ repaired: true }));
    const getSession = vi.fn(async () => session);
    const deps = makeDeps({
      listRecentOrdersWithCheckoutSession: vi.fn(async () => [order]),
      getSession,
      repairSessionBackPointer,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    // The session is looked up by the order's `checkoutSessionId`
    // back-pointer (the session doc id), NOT by Clover's id.
    expect(getSession).toHaveBeenCalledWith('sess_1');
    expect(repairSessionBackPointer).toHaveBeenCalledWith('sess_1', 'ord_1');
    expect(result.backPointersRepaired).toBe(1);
    expect(result.backPointerConflicts).toBe(0);
  });

  it('Given an order whose session already points at it, When the cron runs, Then it skips the back-pointer repair', async () => {
    const order: ReconcileOrder = {
      id: 'ord_1',
      checkoutSessionId: 'sess_1',
      status: 'paid',
      createdAt: new Date(NOW_MS - 60 * 1000),
    };
    const session = makeSession({ status: 'completed', orderId: 'ord_1' });
    const repairSessionBackPointer = vi.fn(async () => ({ repaired: true }));
    const deps = makeDeps({
      listRecentOrdersWithCheckoutSession: vi.fn(async () => [order]),
      getSession: vi.fn(async () => session),
      repairSessionBackPointer,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(repairSessionBackPointer).not.toHaveBeenCalled();
    expect(result.backPointersRepaired).toBe(0);
  });

  it('Given a session already linked to a DIFFERENT order, When the cron runs, Then it records a conflict and does not overwrite', async () => {
    const order: ReconcileOrder = {
      id: 'ord_2',
      checkoutSessionId: 'sess_1',
      status: 'paid',
      createdAt: new Date(NOW_MS - 60 * 1000),
    };
    const session = makeSession({ status: 'completed', orderId: 'ord_1' });
    const repairSessionBackPointer = vi.fn(async () => ({
      repaired: false,
      conflict: 'session.orderId=ord_1 != target ord_2',
    }));
    const deps = makeDeps({
      listRecentOrdersWithCheckoutSession: vi.fn(async () => [order]),
      getSession: vi.fn(async () => session),
      repairSessionBackPointer,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(result.backPointerConflicts).toBe(1);
    expect(result.backPointersRepaired).toBe(0);
  });

  it('skips back-pointer repair for cancelled orders', async () => {
    const order: ReconcileOrder = {
      id: 'ord_x',
      checkoutSessionId: 'sess_x',
      status: 'cancelled',
      createdAt: new Date(NOW_MS - 60 * 1000),
    };
    const getSession = vi.fn();
    const deps = makeDeps({
      listRecentOrdersWithCheckoutSession: vi.fn(async () => [order]),
      getSession,
    });

    await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(getSession).not.toHaveBeenCalled();
  });
});

describe('reconcileCheckoutSessionsImpl — error isolation', () => {
  it('continues processing remaining sessions when one Clover lookup throws', async () => {
    const a = makeSession({ id: 'a', cloverCheckoutSessionId: 'a' });
    const b = makeSession({ id: 'b', cloverCheckoutSessionId: 'b' });
    const lookupCloverCheckout = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ result: 'SUCCESS', cloverOrderId: 'ord_b' });
    const triggerStorefrontPromotion = vi.fn(async () => true);
    const deps = makeDeps({
      listStaleSessions: vi.fn(async () => [a, b]),
      lookupCloverCheckout,
      triggerStorefrontPromotion,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(result.errors).toBe(1);
    expect(result.promoted).toBe(1);
    expect(triggerStorefrontPromotion).toHaveBeenCalledWith('b', 'ord_b');
  });

  it('returns early without touching back-pointer repair when listStaleSessions throws', async () => {
    const listRecentOrdersWithCheckoutSession = vi.fn(async () => []);
    const deps = makeDeps({
      listStaleSessions: vi.fn(async () => {
        throw new Error('firestore down');
      }),
      listRecentOrdersWithCheckoutSession,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(listRecentOrdersWithCheckoutSession).not.toHaveBeenCalled();
    expect(result.scanned).toBe(0);
  });
});

// ─── Refund-pending sweep (#406) ──────────────────────────────────────────

function makeRefundRow(
  overrides: Partial<RefundPendingRow> = {}
): RefundPendingRow {
  return {
    cloverPaymentId: 'pay-1',
    orderId: 'ord-1',
    sessionId: 'sess-1',
    attemptedAt: new Date(NOW_MS - 60 * 60 * 1000),
    lastAttemptedAt: new Date(NOW_MS - 60 * 60 * 1000),
    retryCount: 0,
    lastError: 'clover 500',
    ...overrides,
  };
}

describe('reconcileCheckoutSessionsImpl — refund-pending sweep (#406)', () => {
  it('Given an eligible refund-pending row, When the cron runs, Then it retries and deletes on success', async () => {
    const row = makeRefundRow();
    const retryCloverRefund = vi.fn(async () => undefined);
    const deleteRefundPending = vi.fn(async () => undefined);
    const deps = makeDeps({
      listRefundsPendingForRetry: vi.fn(async () => [row]),
      retryCloverRefund,
      deleteRefundPending,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(retryCloverRefund).toHaveBeenCalledWith('pay-1');
    expect(deleteRefundPending).toHaveBeenCalledWith('pay-1');
    expect(result.refundsRetried).toBe(1);
    expect(result.refundsRecovered).toBe(1);
    expect(result.refundsFailed).toBe(0);
  });

  it('Given a refund retry that fails, When the cron runs, Then markRetryFailed is called and refundsFailed is counted', async () => {
    const row = makeRefundRow({ retryCount: 1 });
    const retryCloverRefund = vi.fn(async () => {
      throw new Error('clover still down');
    });
    const markRefundPendingRetryFailed = vi.fn(async () => undefined);
    const deleteRefundPending = vi.fn(async () => undefined);
    const deps = makeDeps({
      listRefundsPendingForRetry: vi.fn(async () => [row]),
      retryCloverRefund,
      markRefundPendingRetryFailed,
      deleteRefundPending,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(markRefundPendingRetryFailed).toHaveBeenCalledWith(
      'pay-1',
      expect.stringContaining('clover still down')
    );
    expect(deleteRefundPending).not.toHaveBeenCalled();
    expect(result.refundsRetried).toBe(1);
    expect(result.refundsFailed).toBe(1);
    expect(result.refundsRecovered).toBe(0);
    expect(result.refundsExhausted).toBe(0);
  });

  it('Given a row whose next failure crosses MAX_RETRIES, When the cron runs, Then it logs at error level as exhausted', async () => {
    const row = makeRefundRow({ retryCount: REFUND_RETRY_MAX - 1 });
    const log = vi.fn();
    const deps = makeDeps({
      listRefundsPendingForRetry: vi.fn(async () => [row]),
      retryCloverRefund: vi.fn(async () => {
        throw new Error('still failing');
      }),
      log,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(result.refundsExhausted).toBe(1);
    expect(result.refundsFailed).toBe(0);
    const errorCalls = log.mock.calls.filter(c => c[0] === 'error');
    expect(errorCalls.length).toBeGreaterThan(0);
  });

  it('Given a row already at MAX_RETRIES somehow surfacing in the list, When the cron runs, Then it skips retry and logs exhausted', async () => {
    const row = makeRefundRow({ retryCount: REFUND_RETRY_MAX });
    const retryCloverRefund = vi.fn(async () => undefined);
    const deps = makeDeps({
      listRefundsPendingForRetry: vi.fn(async () => [row]),
      retryCloverRefund,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(retryCloverRefund).not.toHaveBeenCalled();
    expect(result.refundsExhausted).toBe(1);
    expect(result.refundsRetried).toBe(0);
  });

  it('Given listRefundsPendingForRetry throws, When the cron runs, Then it logs and continues without crashing', async () => {
    const log = vi.fn();
    const deps = makeDeps({
      listRefundsPendingForRetry: vi.fn(async () => {
        throw new Error('firestore down');
      }),
      log,
    });

    const result = await reconcileCheckoutSessionsImpl(deps, NOW_MS);

    expect(result.refundsRetried).toBe(0);
    const errorCalls = log.mock.calls.filter(c => c[0] === 'error');
    expect(errorCalls.length).toBeGreaterThan(0);
  });
});
