/**
 * GET /api/checkout/[sessionId]/redirect — webhook race handler (#366).
 *
 * After the AgeChecker popup passes, the verify page navigates the
 * customer here. The age-verification result reaches our backend
 * independently via the AgeChecker webhook (#367), which may land
 * BEFORE the customer arrives, DURING the poll, or NEVER.
 *
 * Behavior:
 *   1. Load CheckoutSession.
 *   2. If status === 'completed' or terminal — 409.
 *   3. If status === 'expired' — 409.
 *   4. If already in 'awaiting_payment' (webhook landed first) — 302
 *      to the persisted Clover Hosted Checkout URL.
 *   5. Otherwise poll Firestore via single-read GETs at 250ms backoff
 *      until `ageVerifiedAt !== null` or the timeout elapses.
 *      - On observe → 302 to Clover URL.
 *      - On timeout → 302 to `/checkout/awaiting?session={id}` (#audit H1)
 *        — a real holding page with a "check order status" link, rather
 *        than a raw JSON 408 in the customer's browser. Background work
 *        (the popup's retrying confirm-POST, the reconciler cron) keeps
 *        going; the next attempt redirects to Clover once verified.
 *
 * Polling is intentionally single-read (not a snapshot listener):
 *   - keeps the API route stateless,
 *   - composes with the Admin SDK's request-scoped auth,
 *   - avoids dangling listeners if the request is aborted.
 *
 * Timeout configurable via `CHECKOUT_REDIRECT_TIMEOUT_MS` (default 5000).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutSession } from '@/lib/repositories/checkout-session.repository';

const DEFAULT_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 250;

function getTimeoutMs(): number {
  const raw = process.env.CHECKOUT_REDIRECT_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const { sessionId } = await ctx.params;
  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 }
    );
  }

  const initial = await getCheckoutSession(sessionId);
  if (!initial) {
    return NextResponse.json(
      { error: 'CheckoutSession not found' },
      { status: 404 }
    );
  }

  // Terminal / wrong-state guards.
  if (initial.status === 'completed') {
    return NextResponse.json(
      { error: 'Checkout already completed', orderId: initial.orderId ?? null },
      { status: 409 }
    );
  }
  if (initial.status === 'expired' || initial.status === 'cancelled') {
    return NextResponse.json(
      { error: `Checkout session is ${initial.status}` },
      { status: 409 }
    );
  }

  // Webhook-first: ageVerifiedAt already set OR session already promoted.
  if (initial.ageVerifiedAt !== null || initial.status === 'awaiting_payment') {
    return redirectToClover(initial.cloverCheckoutUrl);
  }

  // Poll: single-read GETs at fixed interval until timeout.
  const timeoutMs = getTimeoutMs();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const next = await getCheckoutSession(sessionId);
    if (!next) {
      return NextResponse.json(
        { error: 'CheckoutSession disappeared during poll' },
        { status: 410 }
      );
    }
    if (next.status === 'expired' || next.status === 'cancelled') {
      return NextResponse.json(
        { error: `Checkout session is ${next.status}` },
        { status: 409 }
      );
    }
    if (next.status === 'completed') {
      return NextResponse.json(
        { error: 'Checkout already completed', orderId: next.orderId ?? null },
        { status: 409 }
      );
    }
    if (next.ageVerifiedAt !== null || next.status === 'awaiting_payment') {
      return redirectToClover(next.cloverCheckoutUrl);
    }
  }

  // Age verification still hasn't landed within the poll window. Rather
  // than dumping a raw JSON 408 in the customer's browser (#audit H1),
  // hand them the holding page, which exposes a "check order status" link
  // back through `/order/{session}/return`. The CheckoutSession reconciler
  // and the popup's own retrying confirm-POST both keep working in the
  // background; once `ageVerifiedAt` lands the next attempt redirects to
  // Clover.
  return NextResponse.redirect(
    new URL(
      `/checkout/awaiting?session=${encodeURIComponent(sessionId)}`,
      req.url
    ),
    302
  );
}

function redirectToClover(url: string | undefined): NextResponse {
  if (!url) {
    // Should never happen for a session created via the v1 flow, but
    // guard explicitly so we never 302 to an empty Location header.
    return NextResponse.json(
      { error: 'Clover checkout URL missing on session' },
      { status: 500 }
    );
  }
  // `NextResponse.redirect()` requires an absolute URL. A relative value
  // (historically produced by the stub path) throws a generic error and
  // surfaces as a 500 to the client. Validate up front and emit a clearer
  // diagnostic so future regressions are easy to triage.
  if (!URL.canParse(url)) {
    return NextResponse.json(
      { error: 'Clover checkout URL is not absolute', url },
      { status: 500 }
    );
  }
  return NextResponse.redirect(url, 302);
}
