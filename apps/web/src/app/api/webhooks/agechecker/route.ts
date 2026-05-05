import { NextResponse } from 'next/server';
import {
  isAgeCheckerTestMode,
  verifyAgeCheckerSignature,
  verifyVerificationId,
  type AgeCheckStatus,
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
 * AgeChecker webhook handler (post-#367).
 *
 * Authoritative outcome for ID verification. Operates on `CheckoutSession`
 * (not Order — orders are not created until Clover capture). The `order`
 * field on the AgeChecker payload carries our **CheckoutSession id**, not
 * an Order id.
 *
 * Responsibilities:
 *   1. Verify HMAC signature (`x-agechecker-signature` header).
 *   2. Defense in depth: re-fetch the verificationId via `verifyVerificationId`.
 *      Reject if the lookup says the id is not actually `pass`.
 *   3. On `pass` → `markAgeVerified(sessionId, verificationId, verifiedAt)`
 *      (transitions `awaiting_id` → `awaiting_payment`).
 *   4. On `deny` / `underage` → `markCheckoutSessionCancelled(sessionId)` plus
 *      `releaseStock(session.holds)` so the storefront sees honest stock.
 *   5. On `pending` / `manual_review` → log only, no state change.
 *   6. Idempotent: if the session is already past `awaiting_id`, ack 200.
 *
 * No Order is created here. Order creation runs from the Clover capture
 * webhook + reconciliation cron (#373 family).
 */
interface AgeCheckerWebhookPayload {
  verificationId?: string;
  status?: string;
  /**
   * Carries our CheckoutSession id (Clover Hosted Checkout session id).
   * Named `order` upstream for legacy compatibility with AgeChecker's
   * widget config — kept that way to avoid touching the customer-facing
   * widget contract.
   */
  order?: string;
  verifiedAt?: string | number;
  email?: string;
}

function normalizeStatus(raw: unknown): AgeCheckStatus {
  if (typeof raw !== 'string') return 'pending';
  const v = raw.toLowerCase();
  if (v === 'pass' || v === 'passed' || v === 'approved' || v === 'verified') {
    return 'pass';
  }
  if (v === 'deny' || v === 'denied' || v === 'rejected' || v === 'fail' || v === 'failed') {
    return 'deny';
  }
  if (v === 'underage') return 'underage';
  if (v === 'manual_review' || v === 'manual' || v === 'review') {
    return 'manual_review';
  }
  return 'pending';
}

function parseDate(raw: unknown): Date | undefined {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function POST(req: Request): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get('x-agechecker-signature');

  if (!verifyAgeCheckerSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: AgeCheckerWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as AgeCheckerWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const verificationId = payload.verificationId;
  const status = normalizeStatus(payload.status);
  const sessionId = payload.order;

  // Non-terminal outcomes: log only.
  if (status === 'pending' || status === 'manual_review') {
    console.warn('[agechecker] non-terminal outcome', {
      verificationId,
      status,
      sessionId,
    });
    return NextResponse.json({ received: true, handled: false });
  }

  if (!verificationId) {
    return NextResponse.json(
      { error: 'Missing verificationId' },
      { status: 400 }
    );
  }
  if (!sessionId) {
    console.warn('[agechecker] terminal outcome without sessionId', {
      verificationId,
      status,
    });
    return NextResponse.json({ received: true, handled: false });
  }

  // Defense in depth: re-fetch the verificationId. A forged "pass" webhook
  // cannot bypass verification — we trust the AgeChecker API over the payload.
  const lookup = await verifyVerificationId(verificationId);

  if (status === 'pass' && !lookup.valid) {
    return NextResponse.json(
      { error: 'verificationId failed lookup' },
      { status: 401 }
    );
  }

  if (status === 'pass') {
    const session = await getCheckoutSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'CheckoutSession not found' },
        { status: 404 }
      );
    }

    // Idempotent: already verified → ack.
    if (session.status !== 'awaiting_id') {
      return NextResponse.json({
        received: true,
        handled: false,
        reason: 'already_processed',
      });
    }

    const verifiedAt =
      lookup.verifiedAt ?? parseDate(payload.verifiedAt) ?? new Date();

    try {
      await markAgeVerified(sessionId, verificationId, verifiedAt);
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

  // Terminal denial: deny / underage (or pass-downgraded-by-lookup).
  if (status === 'deny' || status === 'underage') {
    const session = await getCheckoutSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'CheckoutSession not found' },
        { status: 404 }
      );
    }

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

    // Release the holds so storefront stock is honest. Non-fatal if it fails;
    // the cron sweep will eventually reconcile.
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
