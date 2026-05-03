/**
 * GET /order/{id}/return
 *
 * Clover Hosted Checkout return URL (Path B reconciliation — #279).
 *
 * After payment, Clover redirects the customer back here. We:
 *   1. Resolve the Clover order id from query params (or fall back to the
 *      stored `cloverCheckoutSessionId` on the Order).
 *   2. GET the payment record from Clover.
 *   3. Transition the order to `paid` or `failed` accordingly.
 *   4. Redirect the customer to `/order/{id}` (confirmation page).
 *
 * Idempotent: `InvalidTransitionError` from `transitionStatus` is treated
 * as already-processed (silent no-op) so a customer reload of the return
 * URL after the recovery cron has already settled the order does not
 * surface an error.
 *
 * NOTE: Clover's exact return-URL query parameter names (e.g. checkout
 * session id, order id) need to be confirmed in the sandbox flow. We
 * defensively read several common names and fall back to the stored
 * `cloverCheckoutSessionId`.
 *   TODO(#279-followup): Pin exact param names after a sandbox round-trip.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getOrder,
  setOrderProviderRefs,
  transitionStatus,
  InvalidTransitionError,
} from '@/lib/repositories';
import { getCloverPaymentForOrder } from '@/lib/clover/checkout';

interface Params {
  params: Promise<{ id: string }>;
}

function resolveCloverOrderId(
  url: URL,
  storedSessionId: string | undefined
): string | undefined {
  // Defensive: try several Clover-shaped query parameter names. Refine
  // once sandbox confirms the exact name(s).
  const candidates = [
    url.searchParams.get('orderId'),
    url.searchParams.get('order'),
    url.searchParams.get('checkoutId'),
    url.searchParams.get('checkoutSessionId'),
    url.searchParams.get('sessionId'),
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  return candidates[0] ?? storedSessionId;
}

function confirmationRedirect(req: NextRequest, orderId: string): NextResponse {
  return NextResponse.redirect(new URL(`/order/${orderId}`, req.url));
}

export async function GET(
  req: NextRequest,
  ctx: Params
): Promise<NextResponse> {
  const { id: orderId } = await ctx.params;
  const order = await getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Already settled? Just bounce to the confirmation page (idempotent reload).
  if (order.status !== 'awaiting_payment') {
    return confirmationRedirect(req, orderId);
  }

  const url = new URL(req.url);
  const cloverOrderId = resolveCloverOrderId(
    url,
    order.cloverCheckoutSessionId
  );

  if (!cloverOrderId) {
    // No way to reconcile — leave the order in awaiting_payment so the
    // recovery cron can pick it up later via the stored session id (or a
    // human can investigate).
    return confirmationRedirect(req, orderId);
  }

  let snapshot;
  try {
    snapshot = await getCloverPaymentForOrder(cloverOrderId);
  } catch {
    // Network / API error — let the recovery cron retry.
    return confirmationRedirect(req, orderId);
  }

  if (!snapshot) {
    // Credentials missing on this deployment — nothing we can do.
    return confirmationRedirect(req, orderId);
  }

  try {
    if (snapshot.result === 'SUCCESS') {
      if (snapshot.paymentId) {
        await setOrderProviderRefs(orderId, {});
      }
      await transitionStatus(orderId, 'paid', 'system', {
        cloverPaymentId: snapshot.paymentId,
        source: 'return-url',
      });
    } else if (snapshot.result === 'FAIL') {
      await transitionStatus(orderId, 'failed', 'system', {
        reason: 'clover-payment-failed',
        source: 'return-url',
      });
    }
    // PENDING / UNKNOWN → leave alone; recovery cron will try again.
  } catch (err) {
    if (!(err instanceof InvalidTransitionError)) throw err;
    // Already-processed — silent no-op.
  }

  return confirmationRedirect(req, orderId);
}
