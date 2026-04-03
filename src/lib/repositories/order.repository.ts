/**
 * Order repository — all Firestore access for order documents.
 * Server-side only (uses firebase-admin).
 */
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { Order, OrderStatus } from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function ordersCol() {
  return getAdminFirestore().collection('orders');
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * Fetch a single order by ID.
 * Returns null if not found.
 */
export async function getOrder(id: string): Promise<Order | null> {
  const doc = await ordersCol().doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  return docToOrder(doc.id, data);
}

// ── Write operations ──────────────────────────────────────────────────────

/**
 * Create a new order. Auto-generates an ID and sets createdAt/updatedAt.
 * Returns the new document ID.
 */
export async function createOrder(
  data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date();
  const docRef = ordersCol().doc();
  await docRef.set({ ...data, createdAt: now, updatedAt: now });
  return docRef.id;
}

/**
 * Update the status of an order and optionally set the Redde transaction ID.
 * Always updates updatedAt.
 */
export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  reddeTxnId?: string
): Promise<void> {
  const patch: Record<string, unknown> = { status, updatedAt: new Date() };
  if (reddeTxnId !== undefined) {
    patch.reddeTxnId = reddeTxnId;
  }
  await ordersCol().doc(id).update(patch);
}

// ── Private helpers ───────────────────────────────────────────────────────

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
    reddeTxnId: d.reddeTxnId ?? undefined,
    customerEmail: d.customerEmail ?? undefined,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } satisfies Order;
}
