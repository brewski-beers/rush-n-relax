import { NextResponse } from 'next/server';
import {
  isAgeCheckerTestMode,
  normalizeStatus,
  verifyAgeCheckerSignature,
  verifyVerificationId,
} from '@/lib/agechecker';
import {
  getCheckoutSession,
  markAgeVerified,
  markCheckoutSessionCancelled,
  InvalidCheckoutSessionTransitionError,
  releaseStock,
  type HoldRequest,
} from '@/lib/repositories';

/**
 * AgeChecker verification callback handler.
 *
 * AgeChecker delivers the result via **HTTP PUT** (not POST) to the
 * `callback_url` registered on the server-created session. The body is
 * minimal — `{ uuid, status, reason? }` — and contains NO `metadata` and
 * NO `order`. To resolve our `CheckoutSession`, we must call
 * `GET /v1/status/{uuid}` (via `verifyVerificationId`), which both reads
 * back `metadata.order` AND serves as defense-in-depth (a forged callback
 * cannot fake `accepted` — the AgeChecker API is the source of truth).
 *
 * Authentication: `X-AgeChecker-Signature` = base64 HMAC-SHA1 of the body,
 * keyed with the account secret.
 *
 * Outcome handling (driven by the `/v1/status` lookup, not the callback
 * body):
 *   - `accepted` → `markAgeVerified(sessionId, uuid, verifiedAt)`
 *     (transitions `awaiting_id` → `awaiting_payment`).
 *   - `denied`   → `markCheckoutSessionCancelled(sessionId)` +
 *     `releaseStock(session.holds)`.
 *   - `signature` / `photo_id` / `phone_validation` / `sms_sent` /
 *     `pending` → non-terminal step-up; log only, no state change.
 *   - Idempotent: if the session is already past `awaiting_id`, ack 200.
 *
 * No Order is created here. Order creation runs from the Clover capture
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

  // The callback body has no metadata — resolve the CheckoutSession id and
  // the authoritative outcome by hitting `GET /v1/status/{uuid}`. This is
  // also the defense-in-depth check: we trust the AgeChecker API over the
  // callback body's `status`.
  const lookup = await verifyVerificationId(uuid);
  const sessionId =
    typeof lookup.metadata?.order === 'string'
      ? lookup.metadata.order
      : undefined;

  if (!sessionId) {
    console.warn('[agechecker] callback uuid has no resolvable order', {
      uuid,
      lookupStatus: lookup.status,
      callbackStatus: payload.status,
    });
    return NextResponse.json({ received: true, handled: false });
  }

  // Authoritative status comes from the lookup. `lookup.valid` is the only
  // signal that means "AgeChecker says accepted"; otherwise fall back to
  // the normalized lookup status (deny / pending / step-up).
  const status = lookup.valid ? 'pass' : normalizeStatus(lookup.status);

  // Non-terminal step-up statuses: log only, ack 200, no state change.
  if (status === 'pending' || status === 'manual_review') {
    console.warn('[agechecker] non-terminal outcome — step-up required', {
      uuid,
      sessionId,
      lookupStatus: lookup.status,
      callbackStatus: payload.status,
      reason: payload.reason,
    });
    return NextResponse.json({ received: true, handled: false });
  }

  const session = await getCheckoutSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'CheckoutSession not found' },
      { status: 404 }
    );
  }

  if (status === 'pass') {
    // Idempotent: already verified → ack.
    if (session.status !== 'awaiting_id') {
      return NextResponse.json({
        received: true,
        handled: false,
        reason: 'already_processed',
      });
    }

    const verifiedAt = lookup.verifiedAt ?? new Date();

    try {
      await markAgeVerified(sessionId, uuid, verifiedAt);
    } catch (err) {
      if (err instanceof InvalidCheckoutSessionTransitionError) {
        return NextResponse.json({
          received: true,
          handled: false,
          reason: 'already_processed',
        });
      }
      throw err;
    }

    return NextResponse.json({ received: true, handled: true });
  }

  // Terminal denial: deny / underage.
  if (status === 'deny' || status === 'underage') {
    // Idempotent: already cancelled / past awaiting_id → ack without redo.
    if (session.status === 'cancelled') {
      return NextResponse.json({
        received: true,
        handled: false,
        reason: 'already_processed',
      });
    }

    try {
      await markCheckoutSessionCancelled(sessionId);
    } catch (err) {
      if (err instanceof InvalidCheckoutSessionTransitionError) {
        return NextResponse.json({
          received: true,
          handled: false,
          reason: 'already_processed',
        });
      }
      throw err;
    }

    // Release the holds so storefront stock is honest. Non-fatal if it
    // fails; the cron sweep will eventually reconcile.
    const holds: HoldRequest[] = (session.holds ?? []).map(h => ({
      productId: h.productId,
      variantId: h.variantId,
      locationId: h.locationId,
      qty: h.qty,
    }));
    if (holds.length > 0) {
      try {
        await releaseStock(holds, {
          source: 'order',
          actor: 'webhook:agechecker',
          reason: `agechecker:${status}`,
        });
      } catch (err) {
        console.error('[agechecker] releaseStock failed', {
          sessionId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({ received: true, handled: true });
  }

  // Should not reach — defensive ack.
  console.warn('[agechecker] unhandled status', {
    status,
    testMode: isAgeCheckerTestMode(),
  });
  return NextResponse.json({ received: true, handled: false });
}

/**
 * Defensive alias — AgeChecker uses PUT, but accepting POST as well costs
 * nothing and tolerates config drift / manual replays.
 */
export const POST = PUT;
