/**
 * CheckoutSession schema (#360).
 *
 * Bridging state between cart (browser-only) and Order (post-payment).
 * Holds line items + reserved stock + provider session id while the
 * customer completes ID verification and Clover Hosted Checkout.
 *
 * Lifecycle:
 *   awaiting_id ── awaiting_payment ── completed
 *                                  └── cancelled
 *                                  └── expired
 *   awaiting_id can also transition directly to cancelled or expired.
 *
 * All access is server-side via Admin SDK. No client reads/writes.
 */
import type { OrderItem, ShippingAddress } from './order';

export type CheckoutSessionStatus =
  | 'awaiting_id'
  | 'awaiting_payment'
  | 'completed'
  | 'expired'
  | 'cancelled';

/**
 * A single stock hold attached to a CheckoutSession. Mirrors the shape
 * used by `holdStock` / `releaseStock` / `commitStock` in the product
 * repository (#361).
 */
export interface CheckoutSessionHold {
  productId: string;
  variantId: string;
  locationId: string;
  qty: number;
}

export interface CheckoutSession {
  /** Firestore document id. */
  id: string;
  items: OrderItem[];
  /** cents */
  subtotal: number;
  /** cents */
  tax: number;
  /** cents */
  total: number;
  /** Origin/store slug fulfilling the eventual order. */
  locationId: string;
  /** Required — checkout sessions are delivery-only. */
  deliveryAddress: ShippingAddress;
  /** Optional until the session reaches `awaiting_payment` (filled at ID step). */
  customerEmail?: string;
  status: CheckoutSessionStatus;
  /** Set when ID verification succeeds; null until then. */
  ageVerifiedAt: Date | null;
  /** AgeChecker session id — null until verification completes. */
  verificationId: string | null;
  /** Stock holds taken when the session was created. */
  holds: CheckoutSessionHold[];
  /** Clover Hosted Checkout session id — set at session creation. */
  cloverCheckoutSessionId: string;
  createdAt: Date;
  updatedAt: Date;
  /** Absolute time after which a cron sweep may expire the session. */
  expiresAt: Date;
  /** Set once the session transitions to `completed` and an Order exists. */
  orderId?: string;
}

/**
 * Allowed status transitions for CheckoutSession. A status not present as
 * a key is terminal (no outbound moves). Mirrors the order.ts pattern.
 */
export const CHECKOUT_SESSION_TRANSITIONS: Record<
  CheckoutSessionStatus,
  CheckoutSessionStatus[]
> = {
  awaiting_id: ['awaiting_payment', 'cancelled', 'expired'],
  awaiting_payment: ['completed', 'cancelled', 'expired'],
  completed: [],
  cancelled: [],
  expired: [],
};
