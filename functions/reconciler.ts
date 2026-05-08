/**
 * CheckoutSession reconciler (#369 + #407).
 *
 * Two repair directions, both run on every cron tick:
 *
 * 1. FORWARD repair (#369) — sessions stuck in `awaiting_id` /
 *    `awaiting_payment` past the 15-minute settle window. We ask Clover for
 *    payment status:
 *      - SUCCESS → invoke the storefront's `/order/{sessionId}/return`
 *        endpoint server-side so the canonical promotion pipeline
 *        (`finalizeCheckoutSession`) runs. That route is idempotent — its
 *        Firestore-backed transaction guard wins the race against any
 *        concurrent customer-driven hit.
 *      - FAIL    → mark the session cancelled and release the holds.
 *      - PENDING / UNKNOWN → leave alone, retry next tick.
 *    Sessions whose `expiresAt` has elapsed without payment → mark expired
 *    and release the holds.
 *
 * 2. BACK-POINTER repair (#407) — orders created with `cloverCheckoutSessionId`
 *    set whose linked session does NOT have `orderId` matching back. This
 *    covers the silent Step-3 failure window in `finalizeCheckoutSession`
 *    where steps 1 (createOrder) + 2 (commitStock) succeed but the session
 *    marker write fails. We patch the session forward to `completed` with
 *    the correct orderId. We never overwrite a non-empty session.orderId
 *    with a different value — that's a true conflict and gets logged.
 *
 * The reconciler is structured as pure orchestration with injectable
 * dependencies so it can be unit-tested without touching Firestore /
 * fetch.
 */

export type ReconcileSessionStatus =
  | 'awaiting_id'
  | 'awaiting_payment'
  | 'completed'
  | 'expired'
  | 'cancelled';

export interface ReconcileHold {
  productId: string;
  variantId: string;
  locationId: string;
  qty: number;
}

export interface ReconcileSession {
  id: string;
  status: ReconcileSessionStatus;
  cloverCheckoutSessionId: string;
  holds: ReconcileHold[];
  createdAt: Date;
  expiresAt: Date;
  orderId?: string;
}

export interface ReconcileOrder {
  id: string;
  cloverCheckoutSessionId?: string;
  status: string;
  createdAt: Date;
}

export type CloverPaymentResult = 'SUCCESS' | 'FAIL' | 'PENDING' | 'UNKNOWN';

export interface CloverCheckoutLookup {
  result: CloverPaymentResult;
  /** Clover's order id linked to the checkout session (when available). */
  cloverOrderId?: string;
}

export interface ReconcilerDeps {
  /**
   * Sessions in `awaiting_id` or `awaiting_payment` whose `createdAt` is
   * older than `staleBefore`. Implementation should bound the result set
   * to keep cron runs cheap.
   */
  listStaleSessions(staleBefore: Date): Promise<ReconcileSession[]>;
  /**
   * Recent orders (e.g. last 24h) with `cloverCheckoutSessionId` set —
   * candidates for back-pointer repair.
   */
  listRecentOrdersWithCheckoutSession(since: Date): Promise<ReconcileOrder[]>;
  /** Hydrate a single session by id. */
  getSession(id: string): Promise<ReconcileSession | null>;

  /**
   * Ask Clover for the payment status of a hosted-checkout session. The
   * implementation owns Clover credentials.
   */
  lookupCloverCheckout(
    cloverCheckoutSessionId: string
  ): Promise<CloverCheckoutLookup | null>;

  /**
   * Trigger the storefront's `/order/{sessionId}/return` endpoint so the
   * canonical `finalizeCheckoutSession` pipeline runs. Implementations
   * MUST not follow redirects (the route returns 3xx on success).
   * Returns true on 2xx/3xx, false otherwise.
   */
  triggerStorefrontPromotion(
    cloverCheckoutSessionId: string,
    cloverOrderId: string | undefined
  ): Promise<boolean>;

  /** Mark session expired and decrement reserved on each hold. */
  expireSessionAndReleaseHolds(session: ReconcileSession): Promise<void>;
  /** Mark session cancelled and decrement reserved on each hold. */
  cancelSessionAndReleaseHolds(session: ReconcileSession): Promise<void>;

  /**
   * Patch a session's back-pointer so `status='completed'` and `orderId`
   * point at `targetOrderId`. Implementations must refuse to overwrite a
   * non-empty `orderId` that differs from `targetOrderId` — return false
   * in that case.
   */
  repairSessionBackPointer(
    sessionId: string,
    targetOrderId: string
  ): Promise<{ repaired: boolean; conflict?: string }>;

  /** Structured logger. */
  log(level: 'info' | 'warn' | 'error', msg: string, data?: unknown): void;
}

export interface ReconcileResult {
  scanned: number;
  promoted: number;
  expired: number;
  declined: number;
  pending: number;
  backPointersRepaired: number;
  backPointerConflicts: number;
  errors: number;
}

/** Sessions younger than this are left to the return URL handler. */
export const SETTLE_WINDOW_MS = 15 * 60 * 1000;
/** Look back this far for back-pointer repair candidates. */
export const BACKPOINTER_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export async function reconcileCheckoutSessionsImpl(
  deps: ReconcilerDeps,
  nowMs: number = Date.now()
): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    scanned: 0,
    promoted: 0,
    expired: 0,
    declined: 0,
    pending: 0,
    backPointersRepaired: 0,
    backPointerConflicts: 0,
    errors: 0,
  };

  const staleBefore = new Date(nowMs - SETTLE_WINDOW_MS);
  const now = new Date(nowMs);

  // ─── Direction 1: forward repair ──────────────────────────────────
  let stale: ReconcileSession[];
  try {
    stale = await deps.listStaleSessions(staleBefore);
  } catch (err) {
    deps.log('error', 'listStaleSessions failed', { err: String(err) });
    return result;
  }

  for (const session of stale) {
    result.scanned += 1;

    if (
      session.status !== 'awaiting_id' &&
      session.status !== 'awaiting_payment'
    ) {
      // Concurrent transition — skip.
      continue;
    }

    // Expiry takes precedence over payment lookup.
    if (session.expiresAt.getTime() <= nowMs) {
      try {
        await deps.expireSessionAndReleaseHolds(session);
        result.expired += 1;
        deps.log('info', 'session expired', { sessionId: session.id });
      } catch (err) {
        result.errors += 1;
        deps.log('error', 'expireSession failed', {
          sessionId: session.id,
          err: String(err),
        });
      }
      continue;
    }

    let lookup: CloverCheckoutLookup | null;
    try {
      lookup = await deps.lookupCloverCheckout(session.cloverCheckoutSessionId);
    } catch (err) {
      result.errors += 1;
      deps.log('error', 'lookupCloverCheckout failed', {
        sessionId: session.id,
        err: String(err),
      });
      continue;
    }

    if (!lookup || lookup.result === 'PENDING' || lookup.result === 'UNKNOWN') {
      result.pending += 1;
      continue;
    }

    if (lookup.result === 'FAIL') {
      try {
        await deps.cancelSessionAndReleaseHolds(session);
        result.declined += 1;
        deps.log('info', 'session declined by Clover', {
          sessionId: session.id,
        });
      } catch (err) {
        result.errors += 1;
        deps.log('error', 'cancelSession failed', {
          sessionId: session.id,
          err: String(err),
        });
      }
      continue;
    }

    // SUCCESS — delegate to storefront promotion pipeline.
    try {
      const ok = await deps.triggerStorefrontPromotion(
        session.cloverCheckoutSessionId,
        lookup.cloverOrderId
      );
      if (ok) {
        result.promoted += 1;
        deps.log('info', 'session promoted via storefront', {
          sessionId: session.id,
          cloverOrderId: lookup.cloverOrderId,
        });
      } else {
        result.errors += 1;
      }
    } catch (err) {
      result.errors += 1;
      deps.log('error', 'triggerStorefrontPromotion failed', {
        sessionId: session.id,
        err: String(err),
      });
    }
  }

  // Note: we deliberately do NOT touch `now` for reads above — `nowMs` is
  // the single source of truth.
  void now;

  // ─── Direction 2: back-pointer repair ─────────────────────────────
  const since = new Date(nowMs - BACKPOINTER_LOOKBACK_MS);
  let recent: ReconcileOrder[];
  try {
    recent = await deps.listRecentOrdersWithCheckoutSession(since);
  } catch (err) {
    deps.log('error', 'listRecentOrdersWithCheckoutSession failed', {
      err: String(err),
    });
    return result;
  }

  for (const order of recent) {
    if (!order.cloverCheckoutSessionId) continue;
    // Only repair pointers for orders that actually represent a paid
    // promotion. A cancelled order with a session pointer should not
    // forcibly mark its session completed.
    if (order.status !== 'paid' && order.status !== 'preparing') continue;

    let session: ReconcileSession | null;
    try {
      session = await deps.getSession(order.cloverCheckoutSessionId);
    } catch (err) {
      result.errors += 1;
      deps.log('error', 'getSession failed during back-pointer scan', {
        orderId: order.id,
        err: String(err),
      });
      continue;
    }

    if (!session) continue;
    if (session.status === 'completed' && session.orderId === order.id) {
      // Already correct — nothing to do.
      continue;
    }

    try {
      const outcome = await deps.repairSessionBackPointer(session.id, order.id);
      if (outcome.repaired) {
        result.backPointersRepaired += 1;
        deps.log('info', 'session back-pointer repaired', {
          sessionId: session.id,
          orderId: order.id,
        });
      } else {
        result.backPointerConflicts += 1;
        deps.log('warn', 'session back-pointer conflict — left alone', {
          sessionId: session.id,
          orderId: order.id,
          conflict: outcome.conflict,
        });
      }
    } catch (err) {
      result.errors += 1;
      deps.log('error', 'repairSessionBackPointer failed', {
        sessionId: session.id,
        orderId: order.id,
        err: String(err),
      });
    }
  }

  return result;
}
