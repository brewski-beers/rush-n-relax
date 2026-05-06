/**
 * GET /order/[id]/return — Clover Hosted Checkout return URL (#368).
 *
 * `[id]` is the Clover Hosted Checkout session id, which is also the
 * Firestore doc id of the corresponding `CheckoutSession` (#360). This
 * route is the PRIMARY moment an Order document is created — see
 * `lib/checkout/finalize.ts` for the orchestration, idempotency story,
 * and refund-on-commit-failure compensation.
 *
 * Behavior:
 *   - paid (and not yet promoted) → create order, redirect to /order/{orderId}
 *   - already-completed session   → redirect to /order/{existing orderId}
 *   - awaiting (still pending)    → redirect to /checkout/awaiting?session={id}
 *   - declined / commit-failed    → redirect to /checkout/cancelled?session={id}
 *   - missing session             → redirect home
 *
 * Clover appends an `orderId` query parameter on redirect — we forward it
 * to `finalizeCheckoutSession` for payment lookup. When absent (or when
 * the live-payments kill switch is OFF) the finalizer falls back to the
 * stub success path so dev flows work without real credentials.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { finalizeCheckoutSession } from '@/lib/checkout/finalize';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  ctx: Params
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const cloverOrderId =
    url.searchParams.get('orderId') ??
    url.searchParams.get('cloverOrderId') ??
    undefined;

  let outcome: Awaited<ReturnType<typeof finalizeCheckoutSession>>;
  try {
    outcome = await finalizeCheckoutSession({
      cloverCheckoutSessionId: id,
      cloverOrderId,
    });
  } catch (err) {
    // Unknown session or unexpected error — send the customer somewhere
    // safe. Log so KB can investigate.
    console.error('[order/return] finalize failed', err);
    return NextResponse.redirect(new URL('/', url.origin));
  }

  switch (outcome.kind) {
    case 'paid':
    case 'already-completed':
      return NextResponse.redirect(
        new URL(`/order/${outcome.orderId}`, url.origin)
      );
    case 'awaiting':
      return NextResponse.redirect(
        new URL(
          `/checkout/awaiting?session=${encodeURIComponent(outcome.sessionId)}`,
          url.origin
        )
      );
    case 'declined':
    case 'commit-failed':
      return NextResponse.redirect(
        new URL(
          `/checkout/cancelled?session=${encodeURIComponent(outcome.sessionId)}`,
          url.origin
        )
      );
  }
}
