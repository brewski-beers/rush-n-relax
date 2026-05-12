import { NextResponse } from 'next/server';
import { verifyAgeCheckerSignature } from '@/lib/agechecker';
import { applyAgeVerificationOutcome } from '@/lib/checkout/apply-age-outcome';

/**
 * AgeChecker verification callback handler — **backstop path**.
 *
 * AgeChecker delivers the result via **HTTP PUT** (not POST) to the
 * `callback_url` registered on the server-created session. The body is
 * minimal — `{ uuid, status, reason? }` — and contains NO `metadata` and
 * NO `order`. So this handler resolves our `CheckoutSession` (and the
 * authoritative outcome) via `GET /v1/status/{uuid}` inside
 * `applyAgeVerificationOutcome`, which also doubles as defense-in-depth (a
 * forged callback cannot fake `accepted` — the AgeChecker API is the
 * source of truth).
 *
 * ⚠️ Popup-created verifications do NOT fire this callback by default —
 * AgeChecker only sends "automatic webhooks" for popup requests if their
 * support has enabled it on the account. The customer-driven
 * `POST /api/checkout/[sessionId]/confirm-age` path (fed by the popup's
 * `onstatuschanged` / `oncreated` hooks) is the primary mechanism; this
 * handler is the redundant safety net.
 *
 * Authentication: `X-AgeChecker-Signature` = base64 HMAC-SHA1 of the body,
 * keyed with the account secret.
 *
 * Outcome handling (delegated to `applyAgeVerificationOutcome`, driven by
 * the `/v1/status` lookup, not the callback body):
 *   - `accepted` → `markAgeVerified` (`awaiting_id` → `awaiting_payment`).
 *   - `denied`   → `markCheckoutSessionCancelled` + `releaseStock`.
 *   - step-up statuses → log only, no state change.
 *   - Idempotent: re-deliveries / lost races ack 200.
 *
 * No Order is created here — order creation runs from the Clover capture
 * webhook + reconciliation cron (#373 family).
 *
 * Note: `POST` is exported as a defensive alias to `PUT` — costs nothing
 * and tolerates AgeChecker config drift / manual replays.
 */
interface AgeCheckerCallbackPayload {
  /** AgeChecker verification (or session) uuid. */
  uuid?: string;
  /** Wire status — typically `accepted` or `denied` in the callback. */
  status?: string;
  /** Deny reason, when `status === 'denied'`. */
  reason?: string;
}

export async function PUT(req: Request): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get('x-agechecker-signature');

  if (!verifyAgeCheckerSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: AgeCheckerCallbackPayload;
  try {
    payload = JSON.parse(rawBody) as AgeCheckerCallbackPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const uuid = payload.uuid;
  if (!uuid) {
    return NextResponse.json({ error: 'Missing uuid' }, { status: 400 });
  }

  const outcome = await applyAgeVerificationOutcome({
    verificationUuid: uuid,
    actor: 'webhook:agechecker',
  });

  switch (outcome.kind) {
    case 'verified':
    case 'denied':
      return NextResponse.json({ received: true, handled: true });

    case 'already_verified':
    case 'already_cancelled':
      return NextResponse.json({
        received: true,
        handled: false,
        reason: 'already_processed',
      });

    case 'pending':
      console.warn('[agechecker] non-terminal outcome — step-up required', {
        uuid,
        sessionId: outcome.sessionId,
        callbackStatus: payload.status,
        reason: payload.reason,
      });
      return NextResponse.json({ received: true, handled: false });

    case 'session_not_found':
      return NextResponse.json(
        { error: 'CheckoutSession not found' },
        { status: 404 }
      );

    case 'session_terminal':
      return NextResponse.json({
        received: true,
        handled: false,
        reason: 'already_processed',
      });

    case 'lookup_failed':
      console.warn('[agechecker] callback uuid has no resolvable outcome', {
        uuid,
        callbackStatus: payload.status,
      });
      return NextResponse.json({ received: true, handled: false });
  }
}

/**
 * Defensive alias — AgeChecker uses PUT, but accepting POST as well costs
 * nothing and tolerates config drift / manual replays.
 */
export const POST = PUT;
