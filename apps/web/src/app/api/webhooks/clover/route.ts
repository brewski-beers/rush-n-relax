import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { updateOrderStatus } from '@/lib/repositories/order.repository';
import type { OrderStatus } from '@/types';

/**
 * Clover webhook handler — STUB until sandbox keys arrive.
 *
 * Verifies HMAC signature against CLOVER_WEBHOOK_SECRET when set. Until
 * sandbox keys exist, the handler is effectively dormant (Clover cannot
 * reach this endpoint without a merchant account wired to it).
 */

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.CLOVER_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!header) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(header, 'hex')
    );
  } catch {
    return false;
  }
}

interface CloverEvent {
  type: string;
  data: {
    orderId?: string;
    paymentId?: string;
  };
}

const EVENT_TO_STATUS: Record<string, OrderStatus> = {
  'payment.succeeded': 'paid',
  'payment.failed': 'failed',
  'payment.refunded': 'refunded',
  'payment.voided': 'cancelled',
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-clover-signature');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: CloverEvent;
  try {
    event = JSON.parse(rawBody) as CloverEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const status = EVENT_TO_STATUS[event.type];
  if (!status) {
    return NextResponse.json({ received: true, handled: false });
  }

  const { orderId, paymentId } = event.data;
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  await updateOrderStatus(orderId, status, paymentId);
  return NextResponse.json({ received: true, handled: true });
}
