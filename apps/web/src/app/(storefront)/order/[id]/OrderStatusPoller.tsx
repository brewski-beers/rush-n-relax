'use client';

/**
 * OrderStatusPoller — STUB.
 *
 * Original component polled pre-payment OrderStatus values
 * (`pending_id_verification`, `id_verified`, `awaiting_payment`) and drove
 * the Clover hosted-checkout redirect. Those states were removed in #362
 * (Order is born at payment; pre-payment lifecycle lives on
 * `CheckoutSession`). The component is deleted in #372.
 *
 * Kept as a no-op export so any straggler imports compile cleanly until
 * #372 lands.
 */
export function OrderStatusPoller(): null {
  return null;
}
