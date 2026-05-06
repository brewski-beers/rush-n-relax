/**
 * Order schema — delivery-only lifecycle.
 *
 * Per the checkout-flow rewrite (issue #362 + companion tickets #360, #364–#373),
 * Order documents are born only after a successful Clover payment. Pre-payment
 * lifecycle (ID verification, awaiting_payment, etc.) lives on `CheckoutSession`
 * (see `apps/web/src/types/checkout-session.ts` introduced by #360).
 *
 * ```
 *  paid ── preparing ── out_for_delivery ── completed
 *                                              └── refunded
 *
 *  Most live states can also transition to `cancelled` or `refunded`.
 * ```
 */

export type OrderStatus =
  | 'paid'
  | 'preparing'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  productId: string;
  /**
   * Variant identifier within the product (key of `Product.variants`).
   * Defaults to `'default'` for variantless products and back-compat reads
   * of pre-#308 orders. Required on writes — order creation MUST set this
   * so inventory decrement targets the correct variant/location entry.
   */
  variantId: string;
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
  paid: ['preparing', 'refunded', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled', 'refunded'],
  out_for_delivery: ['completed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
};
