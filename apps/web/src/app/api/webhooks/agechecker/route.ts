import { NextResponse } from 'next/server';
import { verifyAgeCheckerSignature } from '@/lib/agechecker';
import {
  decrementInventoryItems,
  getOrder,
  InsufficientStockError,
  InvalidTransitionError,
  transitionStatus,
} from '@/lib/repositories';

/**
 * AgeChecker webhook handler.
 *
 * Authoritative outcome for ID verification. Drives the order from
 * `pending_id_verification` to either `id_verified` (and decrements
 * inventory atomically) or `id_rejected`. `manual_review` and `pending`
 * are no-ops at the order level — we just log the event.
 *
 * Idempotency: AgeChecker may retry. If the order has already moved past
 * `pending_id_verification`, `transitionStatus` throws
 * `InvalidTransitionError` — we treat that as a duplicate and return 200
 * so the provider stops retrying.
 *
 * Oversell: inventory decrement runs in a Firestore transaction. Any
 * shortage throws `InsufficientStockError`, the whole transaction rolls
 * back, and we return 409. The order is left in `id_verified` (the ID
 * itself is valid) — operations can refund / cancel out of band.
 */

interface AgeCheckerEvent {
  verificationId: string;
  status: string;
  orderId?: string;
  email?: string;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-agechecker-signature');

  if (!verifyAgeCheckerSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: AgeCheckerEvent;
  try {
    event = JSON.parse(rawBody) as AgeCheckerEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { verificationId, status, orderId } = event;

  // No-op outcomes: log only, do not move the order.
  if (status === 'manual_review' || status === 'pending') {
    console.warn('[agechecker] non-terminal outcome', {
      verificationId,
      status,
      orderId,
    });
    return NextResponse.json({ received: true, handled: false });
  }

  if (!orderId) {
    // Terminal outcomes need an order to bind to. Without one, we can only log.
    console.warn('[agechecker] terminal outcome without orderId', {
      verificationId,
      status,
    });
    return NextResponse.json({ received: true, handled: false });
  }

  const actor = `webhook:agechecker`;

  if (status === 'pass') {
    try {
      await transitionStatus(orderId, 'id_verified', actor, {
        verificationId,
      });
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        // Order has already moved past pending_id_verification — duplicate.
        return NextResponse.json({
          received: true,
          handled: false,
          reason: 'already_processed',
        });
      }
      throw err;
    }

    // Inventory decrement is atomic; oversell rolls the whole tx back.
    const order = await getOrder(orderId);
    if (!order) {
      // Should be impossible — transition just succeeded.
      return NextResponse.json(
        { error: 'Order vanished after transition' },
        { status: 500 }
      );
    }

    try {
      await decrementInventoryItems(
        order.locationId,
        order.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
        }))
      );
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json(
          {
            error: 'Insufficient stock',
            productId: err.productId,
            available: err.available,
            requested: err.requested,
          },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({ received: true, handled: true });
  }

  if (status === 'deny' || status === 'underage') {
    try {
      await transitionStatus(orderId, 'id_rejected', actor, {
        verificationId,
        reason: status,
      });
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
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

  // Unknown status — log + ack so AgeChecker doesn't retry forever.
  console.warn('[agechecker] unknown status', {
    verificationId,
    status,
    orderId,
  });
  return NextResponse.json({ received: true, handled: false });
}
