/**
 * CheckoutSession reconciler (#369 + #407).
 *
 * Two repair directions, both run on every cron tick:
 *
 * 1. FORWARD repair (#369) — sessions stuck in `awaiting_id` /
 *    `awaiting_payment` past the 15-minute settle window. We ask Clover for
 *    payment status:
 *      - SUCCESS → invoke the storefront's `/order/{sessionId}/return`
 *        endpoint server-side (where `sessionId` is the CheckoutSession
 *        doc id) so the canonical promotion pipeline
 *        (`finalizeCheckoutSession`) runs. That route is idempotent — its
 *        Firestore-backed transaction guard wins the race against any
 *        concurrent customer-driven hit.
 *      - FAIL    → mark the session cancelled and release the holds.
 *      - PENDING / UNKNOWN → leave alone, retry next tick.
 *    Sessions whose `expiresAt` has elapsed without payment → mark expired
 *    and release the holds.
 *
 * 2. BACK-POINTER repair (#407) — orders created with `checkoutSessionId`
 *    set (the CheckoutSession doc id) whose linked session does NOT have
 *    `orderId` matching back. This covers the silent Step-3 failure window
 *    in `finalizeCheckoutSession` where steps 1 (createOrder) + 2
 *    (commitStock) succeed but the session marker write fails. We patch the
 *    session forward to `completed` with the correct orderId. We never
 *    overwrite a non-empty session.orderId with a different value — that's
 *    a true conflict and gets logged.
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
  /** The CheckoutSession Firestore doc id this order was promoted from. */
  checkoutSessionId?: string;
  /** Clover's own checkout session id (kept for Clover-side reconciliation). */
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

/**
 * Refund-pending queue row (#406). Mirrors the storefront repository's
 * `RefundPendingRecord` shape — kept here as a separate type to avoid a
 * cross-package import from `functions/` into `apps/web/`.
 */
export interface RefundPendingRow {
  cloverPaymentId: string;
  orderId: string;
  sessionId: string;
  attemptedAt: Date;
  lastAttemptedAt: Date;
  retryCount: number;
  lastError: string;
}

export interface ReconcilerDeps {
  /**
   * Sessions in `awaiting_id` or `awaiting_payment` whose `createdAt` is
   * older than `staleBefore`. Implementation should bound the result set
   * to keep cron runs cheap.
   */
  listStaleSessions(staleBefore: Date): Promise<ReconcileSession[]>;
  /**
   * Recent orders (e.g. last 24h) with `checkoutSessionId` set —
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
   * canonical `finalizeCheckoutSession` pipeline runs. `sessionId` is the
   * CheckoutSession Firestore doc id (NOT Clover's checkout id) — that
   * route resolves the session by doc id. Implementations MUST not follow
   * redirects (the route returns 3xx on success). Returns true on
   * 2xx/3xx, false otherwise.
   */
  triggerStorefrontPromotion(
    sessionId: string,
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

  // ─── Refund-pending queue (#406) ────────────────────────────────
  /**
   * Refund-pending rows eligible for retry: `retryCount < maxRetries`
   * AND exponential backoff window elapsed.
   */
  listRefundsPendingForRetry(opts: {
    maxRetries: number;
    now: Date;
  }): Promise<RefundPendingRow[]>;
  /** Attempt a Clover refund for the given payment id. Throws on failure. */
  retryCloverRefund(cloverPaymentId: string): Promise<void>;
  /** Delete a refund-pending row after a successful retry. */
  deleteRefundPending(cloverPaymentId: string): Promise<void>;
  /** Increment retryCount + record lastError after a failed retry. */
  markRefundPendingRetryFailed(
    cloverPaymentId: string,
    error: string
  ): Promise<void>;

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
  // Refund-pending queue counters (#406).
  refundsRetried: number;
  refundsRecovered: number;
  refundsFailed: number;
  refundsExhausted: number;
}

/** Sessions younger than this are left to the return URL handler. */
export const SETTLE_WINDOW_MS = 15 * 60 * 1000;
/** Look back this far for back-pointer repair candidates. */
export const BACKPOINTER_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** Max retry attempts before a refund-pending row is left for manual intervention. */
export const REFUND_RETRY_MAX = 5;

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
    refundsRetried: 0,
    refundsRecovered: 0,
    refundsFailed: 0,
    refundsExhausted: 0,
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

    // NOTE (#audit B3): payment status is checked BEFORE expiry. If a
    // session has both elapsed `expiresAt` AND a successful Clover payment,
    // expiring it would release stock and strand the customer's money with
    // no Order and no refund. So we only fall through to expiry below once
    // we know there's no resolvable payment.

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
      // No resolvable payment yet. NOW it's safe to expire — we won't be
      // pulling stock out from under a SUCCESS payment (#audit B3).
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

    // SUCCESS — delegate to storefront promotion pipeline. The return
    // route resolves the session by its Firestore doc id, so pass
    // `session.id` (NOT Clover's checkout id).
    try {
      const ok = await deps.triggerStorefrontPromotion(
        session.id,
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
    if (!order.checkoutSessionId) continue;
    // Only repair pointers for orders that actually represent a paid
    // promotion. A cancelled order with a session pointer should not
    // forcibly mark its session completed.
    if (order.status !== 'paid' && order.status !== 'preparing') continue;

    let session: ReconcileSession | null;
    try {
      session = await deps.getSession(order.checkoutSessionId);
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

  // ─── Direction 3: refund-pending sweep (#406) ─────────────────────
  let refundQueue: RefundPendingRow[];
  try {
    refundQueue = await deps.listRefundsPendingForRetry({
      maxRetries: REFUND_RETRY_MAX,
      now: new Date(nowMs),
    });
  } catch (err) {
    deps.log('error', 'listRefundsPendingForRetry failed', {
      err: String(err),
    });
    return result;
  }

  for (const row of refundQueue) {
    if (row.retryCount >= REFUND_RETRY_MAX) {
      // Defensive — repository should already filter these out, but
      // surface loudly so monitoring catches the exhausted-retry case.
      result.refundsExhausted += 1;
      deps.log(
        'error',
        'refund-pending exhausted retries — manual intervention required',
        {
          cloverPaymentId: row.cloverPaymentId,
          orderId: row.orderId,
          sessionId: row.sessionId,
          retryCount: row.retryCount,
          lastError: row.lastError,
        }
      );
      continue;
    }

    result.refundsRetried += 1;
    try {
      await deps.retryCloverRefund(row.cloverPaymentId);
      try {
        await deps.deleteRefundPending(row.cloverPaymentId);
        result.refundsRecovered += 1;
        deps.log('info', 'refund-pending recovered via retry', {
          cloverPaymentId: row.cloverPaymentId,
          orderId: row.orderId,
        });
      } catch (delErr) {
        result.errors += 1;
        deps.log('error', 'deleteRefundPending failed after successful retry', {
          cloverPaymentId: row.cloverPaymentId,
          err: String(delErr),
        });
      }
    } catch (refundErr) {
      const detail =
        refundErr instanceof Error ? refundErr.message : String(refundErr);
      try {
        await deps.markRefundPendingRetryFailed(row.cloverPaymentId, detail);
      } catch (markErr) {
        deps.log('error', 'markRefundPendingRetryFailed failed', {
          cloverPaymentId: row.cloverPaymentId,
          err: String(markErr),
        });
      }
      const nextCount = row.retryCount + 1;
      if (nextCount >= REFUND_RETRY_MAX) {
        result.refundsExhausted += 1;
        deps.log(
          'error',
          'refund-pending exhausted retries after this attempt',
          {
            cloverPaymentId: row.cloverPaymentId,
            orderId: row.orderId,
            sessionId: row.sessionId,
            retryCount: nextCount,
            lastError: detail,
          }
        );
      } else {
        result.refundsFailed += 1;
        deps.log('warn', 'refund-pending retry failed — will retry', {
          cloverPaymentId: row.cloverPaymentId,
          retryCount: nextCount,
          err: detail,
        });
      }
    }
  }

  return result;
}
