/**
 * POST /api/checkout/[sessionId]/confirm-age — client-driven age
 * confirmation (**primary path**).
 *
 * AgeChecker's server-to-server `callback_url` does NOT fire for
 * popup-created verifications unless their support has enabled "automatic
 * webhooks" on the account. So the verify page wires the popup's
 * `onstatuschanged` / `oncreated` hooks to POST the verification uuid
 * here; this route does the authoritative `GET /v1/status/{uuid}` lookup
 * and applies the same state transition the webhook would have.
 *
 * Body: `{ verificationUuid: string }`. The `sessionId` comes from the URL
 * — no `metadata.order` round-trip needed for resolution (the lookup
 * still runs, for the authoritative status).
 *
 * Status codes:
 *   - 200 `{ ok: true }`                       — verified now.
 *   - 200 `{ ok: true, alreadyVerified: true }`— idempotent (already past
 *                                                `awaiting_id`, or the
 *                                                webhook won the race).
 *   - 200 `{ ok: true, denied: true }`         — AgeChecker denied;
 *                                                session cancelled + holds
 *                                                released.
 *   - 200 `{ ok: true, pending: true }`        — non-terminal step-up; the
 *                                                customer still has work in
 *                                                the popup.
 *   - 400 — missing/invalid body.
 *   - 404 — no CheckoutSession with this id.
 *   - 409 — session is `completed` / `expired` / `cancelled`.
 *   - 422 `{ ok: false, reason: 'lookup_failed' }` — `/v1/status` did not
 *           resolve; the client should retry/log.
 *
 * Shares all session-mutation logic with the webhook handler via
 * `applyAgeVerificationOutcome` — see that module.
 */
import { NextRequest, NextResponse } from 'next/server';
import { applyAgeVerificationOutcome } from '@/lib/checkout/apply-age-outcome';
import { getCheckoutSession } from '@/lib/repositories/checkout-session.repository';

interface ConfirmAgeBody {
  verificationUuid?: unknown;
}

export async function POST(
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

  let body: ConfirmAgeBody;
  try {
    body = (await req.json()) as ConfirmAgeBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const verificationUuid =
    typeof body.verificationUuid === 'string' && body.verificationUuid
      ? body.verificationUuid
      : null;
  if (!verificationUuid) {
    return NextResponse.json(
      { error: 'verificationUuid is required' },
      { status: 400 }
    );
  }

  // Fast terminal-state guards mirroring the redirect route — answer
  // before any AgeChecker network call when the session can't move.
  const session = await getCheckoutSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'CheckoutSession not found' },
      { status: 404 }
    );
  }
  if (session.status === 'completed') {
    return NextResponse.json(
      { error: 'Checkout already completed', orderId: session.orderId ?? null },
      { status: 409 }
    );
  }
  if (session.status === 'expired' || session.status === 'cancelled') {
    return NextResponse.json(
      { error: `Checkout session is ${session.status}` },
      { status: 409 }
    );
  }
  // Already verified / promoted — idempotent ack without a lookup.
  if (session.status === 'awaiting_payment' || session.ageVerifiedAt !== null) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const outcome = await applyAgeVerificationOutcome({
    verificationUuid,
    sessionId,
    actor: 'confirm-age',
  });

  switch (outcome.kind) {
    case 'verified':
      return NextResponse.json({ ok: true });
    case 'already_verified':
      return NextResponse.json({ ok: true, alreadyVerified: true });
    case 'denied':
      return NextResponse.json({ ok: true, denied: true });
    case 'already_cancelled':
      // Race: webhook (or a parallel confirm) already cancelled it.
      return NextResponse.json(
        { error: `Checkout session is cancelled` },
        { status: 409 }
      );
    case 'pending':
      return NextResponse.json({ ok: true, pending: true });
    case 'session_not_found':
      return NextResponse.json(
        { error: 'CheckoutSession not found' },
        { status: 404 }
      );
    case 'session_terminal':
      return NextResponse.json(
        { error: `Checkout session is ${outcome.status}` },
        { status: 409 }
      );
    case 'lookup_failed':
      return NextResponse.json(
        { ok: false, reason: 'lookup_failed' },
        { status: 422 }
      );
  }
}
