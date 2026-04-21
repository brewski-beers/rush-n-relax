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

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  cloverPaymentId?: string
): Promise<void> {
  const patch: Record<string, unknown> = { status, updatedAt: new Date() };
  if (cloverPaymentId !== undefined) {
    patch.cloverPaymentId = cloverPaymentId;
  }
  await ordersCol().doc(id).update(patch);
}

function docToOrder(id: string, d: FirebaseFirestore.DocumentData): Order {
  return {
    id,
    items: Array.isArray(d.items) ? d.items : [],
    subtotal: d.subtotal ?? 0,
    tax: d.tax ?? 0,
    total: d.total ?? 0,
    locationId: d.locationId ?? '',
    fulfillmentType: d.fulfillmentType ?? 'pickup',
    status: d.status ?? 'pending',
    cloverPaymentId: d.cloverPaymentId ?? undefined,
    customerEmail: d.customerEmail ?? undefined,
    ageVerificationId: d.ageVerificationId ?? undefined,
    shippingAddress:
      (d.shippingAddress as ShippingAddress | undefined) ?? undefined,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } satisfies Order;
}
