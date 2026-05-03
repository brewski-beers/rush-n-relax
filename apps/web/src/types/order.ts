/**
 * Order schema — delivery-only lifecycle.
 *
 * Rush N Relax operates as a delivery-only e-commerce flow (no in-store
 * pickup at checkout). Status transitions follow the lifecycle below; see
 * `ALLOWED_TRANSITIONS` for the legal moves.
 *
 * ```
 *  pending_id_verification
 *      ├── id_verified ── awaiting_payment ── paid ── preparing
 *      │                                                 └── out_for_delivery ── completed
 *      │                                                                          └── refunded
 *      ├── id_rejected
 *      └── failed
 *
 *  Most live states can also transition to `cancelled` or `refunded`.
 * ```
 */

export type OrderStatus =
  | 'pending_id_verification'
  | 'id_verified'
  | 'id_rejected'
  | 'awaiting_payment'
  | 'paid'
  | 'preparing'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  /** cents */
  unitPrice: number;
  /** cents */
  lineTotal: number;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  /** cents */
  subtotal: number;
  /** cents */
  tax: number;
  /** cents */
  total: number;
  /** Origin/store slug fulfilling the order. */
  locationId: string;
  /** Required — orders are delivery-only. */
  deliveryAddress: ShippingAddress;
  status: OrderStatus;
  /**
   * REQUIRED — true means this order was created while the live-payments
   * kill switch was OFF (no real Clover charge). Set inside createOrder()
   * from `isLivePaymentsEnabled()` so callers cannot forget it.
   */
  testMode: boolean;

  // ── Provider references ───────────────────────────────────────────
  /** AgeChecker session id (collected pre-payment). */
  agecheckerSessionId?: string;
  /** Clover Hosted Checkout session id (created when invoking payment). */
  cloverCheckoutSessionId?: string;
  /** Clover payment id (set on successful capture). */
  cloverPaymentId?: string;

  // ── Customer ──────────────────────────────────────────────────────
  customerEmail?: string;

  // ── Lifecycle timestamps ──────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  preparingAt?: Date;
  dispatchedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  refundedAt?: Date;
}

/**
 * Allowed status transitions. A status not present as a key has no outbound
 * transitions (terminal). Use this in repository update helpers and webhook
 * handlers to guard illegal moves.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_id_verification: [
    'id_verified',
    'id_rejected',
    'cancelled',
    'failed',
  ],
  id_verified: ['awaiting_payment', 'cancelled', 'failed'],
  id_rejected: ['cancelled'],
  awaiting_payment: ['paid', 'failed', 'cancelled'],
  paid: ['preparing', 'refunded', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled', 'refunded'],
  out_for_delivery: ['completed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
  failed: ['cancelled'],
};
