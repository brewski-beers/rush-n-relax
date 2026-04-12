/**
 * Redde Payments webhook handler
 * POST /api/redde/webhook
 *
 * Receives payment status events from Redde and updates the corresponding
 * order document in Firestore.
 *
 * Depends on:
 *   - #63 Redde API docs (signature header name and algorithm — TODO below)
 *   - #64 orders repository (updateOrderStatus imported from expected path)
 *
 * Environment variable required: REDDE_WEBHOOK_SECRET
 *   Set in Vercel environment variables.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { updateOrderStatus } from '@/lib/repositories/order.repository';
import type { OrderStatus } from '@/types/order';

// TODO(#63): Confirm signature header name from Redde developer portal.
const SIGNATURE_HEADER = 'x-redde-signature';
const HASH_ALGO = 'sha256';

// ── Redde event types ─────────────────────────────────────────────────────────

/** Subset of known Redde event names. TODO(#63): confirm exact strings. */
type ReddeEventType =
  | 'payment.paid'
  | 'payment.failed'
  | 'payment.voided'
  | 'payment.refunded';

interface ReddeWebhookPayload {
  event: string;
  txnId: string;
  orderId: string;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
}

// ── Event → OrderStatus mapping ───────────────────────────────────────────────

const EVENT_TO_STATUS: Partial<Record<ReddeEventType, OrderStatus>> = {
  'payment.paid': 'paid',
  'payment.failed': 'failed',
  'payment.voided': 'voided',
  'payment.refunded': 'refunded',
};

// ── Signature verification ────────────────────────────────────────────────────

/**
 * Verify HMAC-SHA256 signature.
 * TODO(#63): Confirm format is `sha256=<hex>` once Redde docs confirmed.
 */
function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;

  const [algo, digest] = signatureHeader.split('=');
  if (algo !== HASH_ALGO || !digest) return false;

  const expected = createHmac(HASH_ALGO, secret).update(rawBody).digest('hex');

  try {
    const digestBuf = Buffer.from(digest, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (digestBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(digestBuf, expectedBuf);
  } catch {
    return false;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const rawBody = Buffer.from(await request.arrayBuffer());

  const webhookSecret = process.env.REDDE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[redde/webhook] REDDE_WEBHOOK_SECRET is not set');
    // Return 200 to avoid Redde retrying when misconfigured server-side.
    return new Response(null, { status: 200 });
  }

  const signatureHeader = request.headers.get(SIGNATURE_HEADER);
  if (!verifySignature(rawBody, signatureHeader, webhookSecret)) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: ReddeWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString('utf-8')) as ReddeWebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { event, txnId, orderId } = payload;

  if (!orderId) {
    console.warn('[redde/webhook] Received event without orderId', { event, txnId });
    return new Response(null, { status: 400 });
  }

  const newStatus = EVENT_TO_STATUS[event as ReddeEventType];

  if (!newStatus) {
    // Log unrecognized events but return 200 — Redde must not keep retrying.
    console.warn('[redde/webhook] Unrecognized event type', { event, orderId });
    return new Response(null, { status: 200 });
  }

  try {
    // Idempotent: updateOrderStatus sets status + updatedAt regardless of
    // current value — calling twice with the same status is harmless.
    await updateOrderStatus(orderId, newStatus, txnId);
    console.info('[redde/webhook] Order status updated', {
      orderId,
      event,
      newStatus,
    });
  } catch (err) {
    console.error('[redde/webhook] Failed to update order status', {
      orderId,
      event,
      err,
    });
    // Return 500 so Redde retries — we want to process the event eventually.
    return new Response(
      JSON.stringify({ error: 'Failed to update order' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(null, { status: 200 });
}
