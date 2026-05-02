/**
 * Order repository — all Firestore access for order documents.
 * Server-side only (uses firebase-admin).
 */
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import {
  ALLOWED_TRANSITIONS,
  type Order,
  type OrderEvent,
  type OrderStatus,
  type ShippingAddress,
} from '@/types';

function ordersCol() {
  return getAdminFirestore().collection('orders');
}

function orderEventsCol(orderId: string) {
  return getAdminFirestore()
    .collection('order-events')
    .doc(orderId)
    .collection('events');
}

export class InvalidTransitionError extends Error {
  readonly from: OrderStatus | null;
  readonly to: OrderStatus;

  constructor(from: OrderStatus | null, to: OrderStatus) {
    super(`Invalid order status transition: ${from ?? 'null'} → ${to}`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
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

/**
 * Atomically transition an order from its current status to `to`, append an
 * `OrderEvent` to the audit log, and return the fresh `Order`.
 *
 * Runs inside a Firestore transaction so the read-validate-write sequence is
 * race-free. Throws `InvalidTransitionError` if the move is not in
 * `ALLOWED_TRANSITIONS`.
 */
export async function transitionStatus(
  orderId: string,
  to: OrderStatus,
  actor: OrderEvent['actor'],
  meta?: Record<string, unknown>
): Promise<Order> {
  const db = getAdminFirestore();
  const orderRef = ordersCol().doc(orderId);
  const eventRef = orderEventsCol(orderId).doc();

  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) {
      throw new Error(`Order ${orderId} not found`);
    }
    const data = snap.data();
    if (!data) {
      throw new Error(`Order ${orderId} has no data`);
    }

    const from = (data.status ?? null) as OrderStatus | null;
    const allowed = from ? (ALLOWED_TRANSITIONS[from] ?? []) : [];
    if (!from || !allowed.includes(to)) {
      throw new InvalidTransitionError(from, to);
    }

    const now = new Date();
    const patch: Record<string, unknown> = { status: to, updatedAt: now };
    const stampField = STATUS_TIMESTAMP_FIELD[to];
    if (stampField) {
      patch[stampField] = now;
    }
    // Convenience: lift cloverPaymentId out of meta when callers pass it.
    if (meta && typeof meta.cloverPaymentId === 'string') {
      patch.cloverPaymentId = meta.cloverPaymentId;
    }

    tx.update(orderRef, patch);

    const event: Omit<OrderEvent, 'id'> = {
      orderId,
      from,
      to,
      actor,
      ...(meta ? { meta } : {}),
      createdAt: now,
    };
    tx.set(eventRef, event);

    return { ...data, ...patch, id: orderId };
  });

  return docToOrder(orderId, result);
}

/**
 * Filters supported by `listOrders`. Empty filter object lists all orders
 * (paginated).
 */
export interface ListOrdersOptions {
  status?: OrderStatus;
  locationId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  /** Best-effort prefix match on `customerEmail`. */
  search?: string;
  /** Page size; default 50, max 100. */
  limit?: number;
  /** Opaque cursor returned from a prior call. */
  cursor?: string;
}

export interface ListOrdersResult {
  orders: Order[];
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Cursor-paginated order listing for admin/dashboard surfaces.
 *
 * Uses Firestore `startAfter` over `createdAt desc` for stable ordering. The
 * `cursor` is the previous page's last document id.
 */
export async function listOrders(
  opts: ListOrdersOptions = {}
): Promise<ListOrdersResult> {
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  let query: FirebaseFirestore.Query = ordersCol();

  if (opts.status) {
    query = query.where('status', '==', opts.status);
  }
  if (opts.locationId) {
    query = query.where('locationId', '==', opts.locationId);
  }
  if (opts.dateFrom) {
    query = query.where('createdAt', '>=', opts.dateFrom);
  }
  if (opts.dateTo) {
    query = query.where('createdAt', '<=', opts.dateTo);
  }
  if (opts.search) {
    // Best-effort prefix match using \uf8ff (highest BMP codepoint)
    // as an inclusive upper bound — Firestore range query trick.
    const start = opts.search;
    const end = opts.search + '';
    query = query
      .where('customerEmail', '>=', start)
      .where('customerEmail', '<=', end)
      .orderBy('customerEmail');
  }

  query = query.orderBy('createdAt', 'desc').limit(limit);

  if (opts.cursor) {
    const cursorSnap = await ordersCol().doc(opts.cursor).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  const orders = snap.docs.map(d => docToOrder(d.id, d.data()));
  const nextCursor =
    orders.length === limit ? orders[orders.length - 1].id : null;

  return { orders, nextCursor };
}

/**
 * List `OrderEvent`s for a single order, oldest first. Admin SDK only.
 *
 * Reads from `order-events/{orderId}/events`. Used by admin order-detail
 * pages to render the audit-log timeline.
 */
export async function listOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const snap = await orderEventsCol(orderId).orderBy('createdAt', 'asc').get();
  return snap.docs.map(d => docToOrderEvent(d.id, d.data()));
}

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
function docToOrderEvent(
  id: string,
  d: FirebaseFirestore.DocumentData
): OrderEvent {
  return {
    id,
    orderId: d.orderId ?? '',
    from: (d.from ?? null) as OrderEvent['from'],
    to: d.to as OrderEvent['to'],
    actor: d.actor as OrderEvent['actor'],
    ...(d.meta ? { meta: d.meta as Record<string, unknown> } : {}),
    createdAt: toDate(d.createdAt),
  } satisfies OrderEvent;
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

const EMPTY_ADDRESS: ShippingAddress = {
  name: '',
  line1: '',
  city: '',
  state: '',
  zip: '',
};

// Justified disables: Firestore DocumentData fields are typed `any`. Each
// field is defaulted/coerced below, and the final object is constrained by
// `satisfies Order`, so the runtime shape is safe.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
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
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
