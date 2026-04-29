/**
 * Order repository — all Firestore access for order documents.
 * Server-side only (uses firebase-admin).
 */
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { Order, OrderStatus, ShippingAddress } from '@/types';

function ordersCol() {
  return getAdminFirestore().collection('orders');
}

export async function getOrder(id: string): Promise<Order | null> {
  const doc = await ordersCol().doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  return docToOrder(doc.id, data);
}

export async function createOrder(
  data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date();
  const docRef = ordersCol().doc();
  await docRef.set({ ...data, createdAt: now, updatedAt: now });
  return docRef.id;
}

/**
 * Status-specific milestone fields (see `Order` type). When a status update
 * matches one of these, we stamp the corresponding timestamp alongside
 * `updatedAt`.
 */
const STATUS_TIMESTAMP_FIELD: Partial<Record<OrderStatus, keyof Order>> = {
  paid: 'paidAt',
  preparing: 'preparingAt',
  out_for_delivery: 'dispatchedAt',
  completed: 'completedAt',
  cancelled: 'cancelledAt',
  refunded: 'refundedAt',
};

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  cloverPaymentId?: string
): Promise<void> {
  const now = new Date();
  const patch: Record<string, unknown> = { status, updatedAt: now };
  const stampField = STATUS_TIMESTAMP_FIELD[status];
  if (stampField) {
    patch[stampField] = now;
  }
  if (cloverPaymentId !== undefined) {
    patch.cloverPaymentId = cloverPaymentId;
  }
  await ordersCol().doc(id).update(patch);
}

const EMPTY_ADDRESS: ShippingAddress = {
  name: '',
  line1: '',
  city: '',
  state: '',
  zip: '',
};

function docToOrder(id: string, d: FirebaseFirestore.DocumentData): Order {
  return {
    id,
    items: Array.isArray(d.items) ? d.items : [],
    subtotal: d.subtotal ?? 0,
    tax: d.tax ?? 0,
    total: d.total ?? 0,
    locationId: d.locationId ?? '',
    // Justified cast: Firestore returns DocumentData; deliveryAddress is
    // always written by createOrder via the Order type.
    deliveryAddress:
      (d.deliveryAddress as ShippingAddress | undefined) ?? EMPTY_ADDRESS,
    status: d.status ?? 'pending_id_verification',
    agecheckerSessionId: d.agecheckerSessionId ?? undefined,
    cloverCheckoutSessionId: d.cloverCheckoutSessionId ?? undefined,
    cloverPaymentId: d.cloverPaymentId ?? undefined,
    customerEmail: d.customerEmail ?? undefined,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    paidAt: d.paidAt ? toDate(d.paidAt) : undefined,
    preparingAt: d.preparingAt ? toDate(d.preparingAt) : undefined,
    dispatchedAt: d.dispatchedAt ? toDate(d.dispatchedAt) : undefined,
    completedAt: d.completedAt ? toDate(d.completedAt) : undefined,
    cancelledAt: d.cancelledAt ? toDate(d.cancelledAt) : undefined,
    refundedAt: d.refundedAt ? toDate(d.refundedAt) : undefined,
  } satisfies Order;
}
