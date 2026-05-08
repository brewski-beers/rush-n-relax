/**
 * Finalize a Clover-paid CheckoutSession into a real Order (#368).
 *
 * This is the PRIMARY moment an Order document is created in the new
 * checkout flow. Called from `GET /order/{cloverCheckoutSessionId}/return`
 * after the customer is redirected back from Clover Hosted Checkout.
 *
 * ## Idempotency & concurrency
 *
 * Keyed on `CheckoutSession.status === 'completed'`. A refresh of the
 * return URL after success short-circuits and returns the existing
 * `orderId`.
 *
 * Two concurrent return-URL hits during the ~200ms promotion window
 * could both pass the early `status === 'completed'` check. To prevent
 * double Order creation and double stock commit, `promote()` first
 * atomically claims the session via `markCheckoutSessionInFlight`
 * (`awaiting_payment → in_flight`, transactional). Only the winning
 * caller proceeds; losers see `InvalidCheckoutSessionTransitionError`
 * and re-read the session to return `{ kind: 'already-completed' }`
 * once the winner finishes (#405).
 *
 * ## Atomicity & compensation
 *
 * Firestore does not allow nesting `runTransaction` calls, and
 * `commitStock` already runs its own transaction across N product docs.
 * Rather than re-implementing commitStock inline (high risk for a money-
 * path file), the three writes happen sequentially with explicit
 * compensation if the middle step fails:
 *
 *   1. createOrder()                 — single doc set, atomic
 *   2. commitStock(session.holds)    — atomic across N product docs
 *   3. markCheckoutSessionCompleted  — atomic via transaction
 *
 * Failure handling:
 *   - 1 fails        → throw; nothing written, session unchanged
 *   - 2 fails (race) → refund Clover, transition order to cancelled,
 *                      mark session cancelled. Holds remain held; a cron
 *                      sweep + the standalone release path handle them.
 *   - 3 fails        → loud error log; order + stock are correct, only
 *                      the session pointer is stale. The reconciliation
 *                      cron (#369) will repair on its next pass.
 */

import { isLivePaymentsEnabled } from '@/lib/test-mode';
import {
  CloverApiError,
  getCloverPaymentForOrder,
  refundCloverPayment,
  type CloverPaymentSnapshot,
} from '@/lib/clover/checkout';
import {
  commitStock,
  createOrder,
  enqueueRefundPending,
  getCheckoutSession,
  InvalidCheckoutSessionTransitionError,
  markCheckoutSessionCancelled,
  markCheckoutSessionCompleted,
  markCheckoutSessionInFlight,
  transitionStatus,
} from '@/lib/repositories';
import type { CheckoutSession } from '@/types/checkout-session';
import type { Order } from '@/types';

export type FinalizeOutcome =
  | { kind: 'already-completed'; orderId: string }
  | { kind: 'awaiting'; sessionId: string }
  | { kind: 'declined'; sessionId: string }
  | { kind: 'paid'; orderId: string }
  | { kind: 'commit-failed'; sessionId: string; orderId: string };

export interface FinalizeInput {
  /** Clover Hosted Checkout session id — also our Firestore doc id. */
  cloverCheckoutSessionId: string;
  /**
   * Clover order id passed back via the redirect query string. Required to
   * look up the payment(s) for this checkout. When absent we treat the
   * session as still awaiting payment.
   */
  cloverOrderId?: string;
}

/** Lookup a `CheckoutSession` by its Clover-issued id. Exposed for tests. */
export async function loadSession(
  cloverCheckoutSessionId: string
): Promise<CheckoutSession | null> {
  return getCheckoutSession(cloverCheckoutSessionId);
}

/**
 * Run the promotion pipeline. Pure orchestration — caller decides how to
 * render the outcome.
 */
export async function finalizeCheckoutSession(
  input: FinalizeInput
): Promise<FinalizeOutcome> {
  const session = await loadSession(input.cloverCheckoutSessionId);
  if (!session) {
    // No session means we cannot create an order — caller should 404 / redirect home.
    throw new Error(
      `CheckoutSession '${input.cloverCheckoutSessionId}' not found`
    );
  }

  // 1. Idempotency: if the session is already promoted, return its order.
  if (session.status === 'completed' && session.orderId) {
    return { kind: 'already-completed', orderId: session.orderId };
  }

  // Cancelled / expired sessions never promote.
  if (session.status === 'cancelled' || session.status === 'expired') {
    return { kind: 'declined', sessionId: session.id };
  }

  // 2. Confirm payment with Clover. Without a Clover order id we cannot
  //    look up the payment — assume the customer abandoned and leave the
  //    session for the reconciler.
  let payment: CloverPaymentSnapshot | null = null;
  if (input.cloverOrderId) {
    payment = await getCloverPaymentForOrder(input.cloverOrderId);
  }

  if (!payment) {
    // Live-payments off OR no cloverOrderId in query. In test/dev mode we
    // synthesize a SUCCESS so engineers can exercise the happy path against
    // the emulator without needing real Clover credentials.
    if (!isLivePaymentsEnabled()) {
      return promote(session, /* paymentId */ undefined);
    }
    return { kind: 'awaiting', sessionId: session.id };
  }

  if (payment.result === 'PENDING' || payment.result === 'UNKNOWN') {
    return { kind: 'awaiting', sessionId: session.id };
  }

  if (payment.result === 'FAIL') {
    // Hard decline — release the session (holds will be reaped by cron).
    await markCheckoutSessionCancelled(session.id).catch(() => {
      // Already terminal? Fine — outcome is the same.
    });
    return { kind: 'declined', sessionId: session.id };
  }

  // SUCCESS → run the promotion pipeline.
  return promote(session, payment.paymentId);
}

async function promote(
  session: CheckoutSession,
  cloverPaymentId: string | undefined
): Promise<FinalizeOutcome> {
  // Step 0 — atomically claim the session (#405). Transition
  // `awaiting_payment → in_flight` inside a transaction. The losing
  // caller in a race throws InvalidCheckoutSessionTransitionError; we
  // re-read and return the winner's orderId (or wait-state if the
  // winner has not finished writing it yet).
  try {
    await markCheckoutSessionInFlight(session.id);
  } catch (claimErr) {
    if (claimErr instanceof InvalidCheckoutSessionTransitionError) {
      const fresh = await loadSession(session.id);
      if (fresh?.status === 'completed' && fresh.orderId) {
        return { kind: 'already-completed', orderId: fresh.orderId };
      }
      // Winner is still in-flight, or session ended in cancelled/expired.
      // Return `awaiting` so the caller renders the holding page; the
      // next refresh will resolve to `already-completed` (or `declined`
      // if the winner's commit failed).
      if (fresh?.status === 'cancelled' || fresh?.status === 'expired') {
        return { kind: 'declined', sessionId: session.id };
      }
      return { kind: 'awaiting', sessionId: session.id };
    }
    throw claimErr;
  }

  // Step 1 — create the Order document.
  const orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'testMode'> =
    {
      items: session.items,
      subtotal: session.subtotal,
      tax: session.tax,
      total: session.total,
      locationId: session.locationId,
      deliveryAddress: session.deliveryAddress,
      status: 'paid',
      paidAt: new Date(),
      cloverCheckoutSessionId: session.cloverCheckoutSessionId,
      ...(cloverPaymentId ? { cloverPaymentId } : {}),
      ...(session.customerEmail
        ? { customerEmail: session.customerEmail }
        : {}),
    };

  const orderId = await createOrder(orderData);

  // Step 2 — commit reserved stock to a real decrement.
  try {
    await commitStock(session.holds, {
      source: 'order',
      reason: `checkout-session ${session.id}`,
    });
  } catch (commitErr) {
    // Race: stock dropped between hold and commit (e.g. an admin manual
    // adjustment, or a parallel checkout). Refund + cancel.
    await compensateOnCommitFailure({
      orderId,
      cloverPaymentId,
      sessionId: session.id,
      reason:
        commitErr instanceof Error ? commitErr.message : String(commitErr),
    });
    return { kind: 'commit-failed', sessionId: session.id, orderId };
  }

  // Step 3 — flip the session to completed and link the order.
  try {
    await markCheckoutSessionCompleted(session.id, orderId);
  } catch (markErr) {
    // Order + stock are already correct; only the session pointer is
    // stale. The reconciler (#369) will repair. Surface a loud error.
    console.error(
      `[finalizeCheckoutSession] order ${orderId} created but session ${session.id} not marked completed`,
      markErr
    );
  }

  return { kind: 'paid', orderId };
}

interface CompensationInput {
  orderId: string;
  cloverPaymentId: string | undefined;
  sessionId: string;
  reason: string;
}

async function compensateOnCommitFailure(c: CompensationInput): Promise<void> {
  // Refund first — money is the most expensive thing to leave behind.
  if (c.cloverPaymentId) {
    try {
      await refundCloverPayment(c.cloverPaymentId);
    } catch (refundErr) {
      // Refund failure is operationally critical. Log loudly; KB / cron
      // will retry. Do NOT throw — we still want to flip statuses so the
      // customer-facing UI shows "cancelled" not "paid".
      const detail =
        refundErr instanceof CloverApiError
          ? `${refundErr.status}: ${refundErr.body.slice(0, 200)}`
          : String(refundErr);
      console.error(
        `[finalizeCheckoutSession] REFUND FAILED for payment ${c.cloverPaymentId} (order ${c.orderId}): ${detail}`
      );
      // Enqueue for cron retry — don't drop the failure on the floor (#406).
      try {
        await enqueueRefundPending({
          cloverPaymentId: c.cloverPaymentId,
          orderId: c.orderId,
          sessionId: c.sessionId,
          error: detail,
          createdBy: 'finalize',
        });
      } catch (enqueueErr) {
        console.error(
          `[finalizeCheckoutSession] failed to enqueue refund-pending for payment ${c.cloverPaymentId}`,
          enqueueErr
        );
      }
    }
  }

  // Move the order to cancelled so the customer-facing /order/{id} page
  // doesn't claim "paid". Best-effort.
  await transitionStatus(c.orderId, 'cancelled', 'system', {
    reason: `commit-stock failed: ${c.reason}`,
  }).catch(err => {
    console.error(
      `[finalizeCheckoutSession] failed to cancel order ${c.orderId}`,
      err
    );
  });

  await markCheckoutSessionCancelled(c.sessionId).catch(err => {
    console.error(
      `[finalizeCheckoutSession] failed to cancel session ${c.sessionId}`,
      err
    );
  });
}
