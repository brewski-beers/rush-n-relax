/**
 * Order repository — all Firestore access for order documents.
 * Server-side only (uses firebase-admin).
 */
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { Order, OrderItem, OrderStatus } from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function ordersCol() {
  return getAdminFirestore().collection('orders');
}

// ── Write operations ──────────────────────────────────────────────────────

/**
 * Create a new order document.
 * Auto-generates the document ID and sets createdAt/updatedAt.
 * Returns the new order ID.
 */
export async function createOrder(
  data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = ordersCol();
  const now = new Date();
  const docRef = col.doc();
  await docRef.set({ ...data, createdAt: now, updatedAt: now });
  return docRef.id;
}

/**
 * Update an order's status. Optionally record the Redde transaction ID.
 * Always sets updatedAt to now.
 */
export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  reddeTxnId?: string
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };
  if (reddeTxnId !== undefined) {
    updatePayload.reddeTxnId = reddeTxnId;
  }
  await ordersCol().doc(id).update(updatePayload);
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

// ── Private helpers ───────────────────────────────────────────────────────

function docToOrder(id: string, d: FirebaseFirestore.DocumentData): Order {
  return {
    id,
    items: (d.items as OrderItem[]) ?? [],
    subtotal: d.subtotal as number,
    tax: d.tax as number,
    total: d.total as number,
    locationId: d.locationId as string,
    fulfillmentType: d.fulfillmentType,
    status: d.status,
    reddeTxnId: d.reddeTxnId ?? undefined,
    customerEmail: d.customerEmail ?? undefined,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } satisfies Order;
}
