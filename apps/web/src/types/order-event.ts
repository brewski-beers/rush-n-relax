import type { OrderStatus } from './order';

/**
 * Audit log entry for an order status transition.
 *
 * Stored at `order-events/{orderId}/events/{eventId}` (subcollection per order).
 * Admin SDK only — clients have no access (see `firestore.rules`).
 *
 * One event is appended for every status change: webhook handlers, scheduled
 * jobs, and admin actions all write through the same path so the order's
 * lifecycle is fully reconstructable from this log.
 */
export interface OrderEvent {
  id: string;
  orderId: string;
  /** Previous status. `null` only for the initial create event. */
  from: OrderStatus | null;
  /** New status after the transition. */
  to: OrderStatus;
  /**
   * Origin of the transition.
   * - `system` — internal job (e.g. cleanup, scheduled refund window)
   * - `webhook:agechecker` — AgeChecker callback
   * - `webhook:clover` — Clover Hosted Checkout / payment webhook
   * - `admin:{uid}` — manual admin action; uid is the actor's auth uid
   */
  actor: 'system' | 'webhook:agechecker' | 'webhook:clover' | `admin:${string}`;
  /** Free-form provider payload (webhook id, refund reason, etc.). */
  meta?: Record<string, unknown>;
  createdAt: Date;
}
