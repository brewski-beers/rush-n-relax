'use server';

/**
 * Admin order Server Actions (#283).
 *
 * Three operations exposed to the admin order detail page:
 *   - transitionOrderAction  — move the order through a state allowed by
 *                              ALLOWED_TRANSITIONS; appends an audit event
 *                              tagged actor='admin:{uid}'.
 *   - resendOrderEmailAction — re-enqueue an outbound-emails job for a
 *                              specific event-log row.
 *   - refundOrderAction      — call Clover refund API + transition to
 *                              `refunded`. Gated on order.status === 'paid'.
 *
 * Every action is gated by requireRole('staff') and writes the actor uid
 * into the OrderEvent.
 */

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import {
  getOrder,
  transitionStatus,
  InvalidTransitionError,
} from '@/lib/repositories';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { refundCloverPayment } from '@/lib/clover/checkout';
import {
  ALLOWED_TRANSITIONS,
  type OrderStatus,
  type OrderEvent,
} from '@/types';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const STATUS_TO_EMAIL_TEMPLATE: Partial<Record<OrderStatus, string>> = {
  pending_id_verification: 'order_received',
  id_verified: 'id_verified',
  id_rejected: 'id_rejected',
  paid: 'payment_confirmed',
  preparing: 'order_preparing',
  out_for_delivery: 'order_out_for_delivery',
  completed: 'order_completed',
  cancelled: 'order_cancelled',
  refunded: 'order_refunded',
};

function assertAllowedTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export async function transitionOrderAction(
  orderId: string,
  to: OrderStatus
): Promise<ActionResult> {
  const actor = await requireRole('staff');
  const order = await getOrder(orderId);
  if (!order) return { ok: false, error: 'Order not found' };

  try {
    assertAllowedTransition(order.status, to);
    await transitionStatus(orderId, to, `admin:${actor.uid}`, {
      adminEmail: actor.email,
    });
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return {
        ok: false,
        error: `Cannot transition ${order.status} → ${to}`,
      };
    }
    throw err;
  }
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function resendOrderEmailAction(
  orderId: string,
  eventId: string
): Promise<ActionResult> {
  const actor = await requireRole('staff');
  const db = getAdminFirestore();

  const eventSnap = await db
    .collection('order-events')
    .doc(orderId)
    .collection('events')
    .doc(eventId)
    .get();
  if (!eventSnap.exists) return { ok: false, error: 'Event not found' };
  const eventData = eventSnap.data();
  if (!eventData) return { ok: false, error: 'Event has no data' };
  const to = eventData.to as OrderStatus;
  const templateId = STATUS_TO_EMAIL_TEMPLATE[to];
  if (!templateId) {
    return {
      ok: false,
      error: `No email template mapped for status '${to}'`,
    };
  }

  const order = await getOrder(orderId);
  if (!order) return { ok: false, error: 'Order not found' };
  if (!order.customerEmail) {
    return { ok: false, error: 'Order has no customer email on file' };
  }

  const now = new Date();
  await db.collection('outbound-emails').add({
    to: order.customerEmail,
    templateId,
    vars: {
      order: { ...order, status: to },
      customer: {
        name: order.deliveryAddress.name,
        email: order.customerEmail,
      },
      deliveryAddress: order.deliveryAddress,
    },
    status: 'pending',
    createdAt: now,
    resent: true,
    resentBy: `admin:${actor.uid}`,
    resentForEventId: eventId,
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function refundOrderAction(
  orderId: string,
  amount?: number
): Promise<ActionResult> {
  const actor = await requireRole('staff');
  const order = await getOrder(orderId);
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.status !== 'paid') {
    return {
      ok: false,
      error: `Refunds require status 'paid' (current: ${order.status})`,
    };
  }
  if (!order.cloverPaymentId) {
    return { ok: false, error: 'Order has no Clover payment id on file' };
  }

  let refundId: string | undefined;
  try {
    const result = await refundCloverPayment(order.cloverPaymentId, amount);
    refundId = result.refundId;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Refund failed',
    };
  }

  const meta: Record<string, unknown> = {
    cloverPaymentId: order.cloverPaymentId,
    refundId,
    adminEmail: actor.email,
  };
  if (amount !== undefined) meta.amount = amount;

  try {
    await transitionStatus(
      orderId,
      'refunded',
      `admin:${actor.uid}` satisfies OrderEvent['actor'],
      meta
    );
  } catch (err) {
    if (!(err instanceof InvalidTransitionError)) throw err;
    // Already refunded — silent.
  }

  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}
