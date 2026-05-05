/**
 * CheckoutSession repository (#360) — all Firestore access for the
 * `checkout-sessions/{sessionId}` collection. Server-side only via
 * Admin SDK.
 *
 * Documents are keyed by Clover Hosted Checkout session id so the
 * Clover webhook can locate the session via `getCheckoutSession(id)`.
 */
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import {
  CHECKOUT_SESSION_TRANSITIONS,
  type CheckoutSession,
  type CheckoutSessionHold,
  type CheckoutSessionStatus,
} from '@/types/checkout-session';
import type { OrderItem, ShippingAddress } from '@/types';

const COLLECTION = 'checkout-sessions';

function checkoutSessionsCol() {
  return getAdminFirestore().collection(COLLECTION);
}

export class DuplicateCheckoutSessionError extends Error {
  readonly cloverCheckoutSessionId: string;

  constructor(cloverCheckoutSessionId: string) {
    super(
      `CheckoutSession already exists for cloverCheckoutSessionId '${cloverCheckoutSessionId}'`
    );
    this.name = 'DuplicateCheckoutSessionError';
    this.cloverCheckoutSessionId = cloverCheckoutSessionId;
  }
}

export class InvalidCheckoutSessionTransitionError extends Error {
  readonly from: CheckoutSessionStatus | null;
  readonly to: CheckoutSessionStatus;

  constructor(
    from: CheckoutSessionStatus | null,
    to: CheckoutSessionStatus
  ) {
    super(
      `Invalid checkout session transition: ${from ?? 'null'} → ${to}`
    );
    this.name = 'InvalidCheckoutSessionTransitionError';
    this.from = from;
    this.to = to;
  }
}

/**
 * Fields the caller supplies on creation. Status, timestamps, holds, and
 * verification fields are owned by the repository.
 */
export interface CreateCheckoutSessionInput {
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  locationId: string;
  deliveryAddress: ShippingAddress;
  customerEmail?: string;
  holds: CheckoutSessionHold[];
  cloverCheckoutSessionId: string;
  /** Persisted Clover Hosted Checkout redirect URL. Optional — stub provider does not return one. */
  cloverCheckoutUrl?: string;
  /** Absolute expiry time for the cron sweep. */
  expiresAt: Date;
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<string> {
  if (!input.cloverCheckoutSessionId) {
    throw new Error('cloverCheckoutSessionId is required');
  }
  const now = new Date();
  const ref = checkoutSessionsCol().doc(input.cloverCheckoutSessionId);
  const payload: Omit<CheckoutSession, 'id'> = {
    items: input.items,
    subtotal: input.subtotal,
    tax: input.tax,
    total: input.total,
    locationId: input.locationId,
    deliveryAddress: input.deliveryAddress,
    ...(input.customerEmail !== undefined
      ? { customerEmail: input.customerEmail }
      : {}),
    status: 'awaiting_id',
    ageVerifiedAt: null,
    verificationId: null,
    holds: input.holds,
    cloverCheckoutSessionId: input.cloverCheckoutSessionId,
    ...(input.cloverCheckoutUrl !== undefined
      ? { cloverCheckoutUrl: input.cloverCheckoutUrl }
      : {}),
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt,
  };
  try {
    await ref.create(payload);
  } catch (err: unknown) {
    // Firestore Admin SDK throws on .create() when the doc already exists.
    // Surface a typed error so the Clover webhook can handle retries
    // idempotently instead of silently overwriting age-verification state.
    const code = (err as { code?: number | string } | null)?.code;
    if (code === 6 || code === 'already-exists') {
      throw new DuplicateCheckoutSessionError(input.cloverCheckoutSessionId);
    }
    throw err;
  }
  return ref.id;
}

export async function getCheckoutSession(
  id: string
): Promise<CheckoutSession | null> {
  const snap = await checkoutSessionsCol().doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data) return null;
  return docToCheckoutSession(snap.id, data);
}

/**
 * Mark a session as age-verified and transition to `awaiting_payment`.
 * Atomic — runs inside a Firestore transaction so the read-validate-write
 * cycle is race-free.
 */
export async function markAgeVerified(
  id: string,
  verificationId: string,
  verifiedAt: Date
): Promise<CheckoutSession> {
  return runTransition(id, 'awaiting_payment', {
    ageVerifiedAt: verifiedAt,
    verificationId,
  });
}

export async function markCheckoutSessionCompleted(
  id: string,
  orderId: string
): Promise<CheckoutSession> {
  return runTransition(id, 'completed', { orderId });
}

export async function markCheckoutSessionExpired(
  id: string
): Promise<CheckoutSession> {
  return runTransition(id, 'expired', {});
}

export async function markCheckoutSessionCancelled(
  id: string
): Promise<CheckoutSession> {
  return runTransition(id, 'cancelled', {});
}

async function runTransition(
  id: string,
  to: CheckoutSessionStatus,
  extra: Record<string, unknown>
): Promise<CheckoutSession> {
  const db = getAdminFirestore();
  const ref = checkoutSessionsCol().doc(id);

  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error(`CheckoutSession '${id}' not found`);
    }
    const data = snap.data();
    if (!data) {
      throw new Error(`CheckoutSession '${id}' has no data`);
    }
    const from = (data.status ?? null) as CheckoutSessionStatus | null;
    const allowed = from ? CHECKOUT_SESSION_TRANSITIONS[from] : [];
    if (!from || !allowed.includes(to)) {
      throw new InvalidCheckoutSessionTransitionError(from, to);
    }
    const now = new Date();
    const patch: Record<string, unknown> = {
      ...extra,
      status: to,
      updatedAt: now,
    };
    tx.update(ref, patch);
    return { ...data, ...patch, id };
  });

  return docToCheckoutSession(id, result);
}

function docToCheckoutSession(
  id: string,
  d: FirebaseFirestore.DocumentData
): CheckoutSession {
  const items: OrderItem[] = Array.isArray(d.items)
    ? (d.items as Record<string, unknown>[]).map(it => ({
        productId: typeof it.productId === 'string' ? it.productId : '',
        variantId:
          typeof it.variantId === 'string' && it.variantId.length > 0
            ? it.variantId
            : 'default',
        productName: typeof it.productName === 'string' ? it.productName : '',
        quantity: typeof it.quantity === 'number' ? it.quantity : 0,
        unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : 0,
        lineTotal: typeof it.lineTotal === 'number' ? it.lineTotal : 0,
      }))
    : [];

  const holds: CheckoutSessionHold[] = Array.isArray(d.holds)
    ? (d.holds as Record<string, unknown>[]).map(h => ({
        productId: typeof h.productId === 'string' ? h.productId : '',
        variantId: typeof h.variantId === 'string' ? h.variantId : 'default',
        locationId: typeof h.locationId === 'string' ? h.locationId : '',
        qty: typeof h.qty === 'number' ? h.qty : 0,
      }))
    : [];

  const EMPTY_ADDRESS: ShippingAddress = {
    name: '',
    line1: '',
    city: '',
    state: '',
    zip: '',
  };

  return {
    id,
    items,
    subtotal: typeof d.subtotal === 'number' ? d.subtotal : 0,
    tax: typeof d.tax === 'number' ? d.tax : 0,
    total: typeof d.total === 'number' ? d.total : 0,
    locationId: typeof d.locationId === 'string' ? d.locationId : '',
    deliveryAddress:
      (d.deliveryAddress as ShippingAddress | undefined) ?? EMPTY_ADDRESS,
    ...(typeof d.customerEmail === 'string'
      ? { customerEmail: d.customerEmail }
      : {}),
    status: (d.status ?? 'awaiting_id') as CheckoutSessionStatus,
    ageVerifiedAt: d.ageVerifiedAt ? toDate(d.ageVerifiedAt) : null,
    verificationId:
      typeof d.verificationId === 'string' ? d.verificationId : null,
    holds,
    cloverCheckoutSessionId:
      typeof d.cloverCheckoutSessionId === 'string'
        ? d.cloverCheckoutSessionId
        : id,
    ...(typeof d.cloverCheckoutUrl === 'string'
      ? { cloverCheckoutUrl: d.cloverCheckoutUrl }
      : {}),
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    expiresAt: toDate(d.expiresAt),
    ...(typeof d.orderId === 'string' ? { orderId: d.orderId } : {}),
  } satisfies CheckoutSession;
}
