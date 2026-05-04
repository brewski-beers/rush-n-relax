'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/hooks/useCart';
import type { OrderStatus } from '@/types';

interface OrderStatusPollerProps {
  orderId: string;
  /** Initial status from server render. */
  initialStatus: OrderStatus;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 24; // ~2 minutes

async function fetchOrderStatus(orderId: string): Promise<OrderStatus | null> {
  const res = await fetch(`/api/order/${orderId}/status`);
  if (!res.ok) return null;
  // Justified cast: API contract returns { status: OrderStatus }
  const data = (await res.json()) as { status: OrderStatus };
  return data.status;
}

/**
 * States that mean we are still waiting for the server-side flow to advance:
 *  - id_verified       → we trigger /api/checkout/session ourselves
 *  - awaiting_payment  → waiting for Clover redirect (or webhook)
 *
 * `pending_id_verification` was removed when the cart flow was switched to
 * the JS-widget path: orders now create directly in `id_verified` and the
 * pre-verification state is no longer reachable from the storefront. The
 * OrderStatus union still includes it for the inbound webhook + admin
 * surfaces, but the poller is no longer responsible for that transition.
 */
const POLLING_STATES: ReadonlySet<OrderStatus> = new Set([
  'id_verified',
  'awaiting_payment',
]);

/**
 * Client island that polls /api/order/[id]/status while the order is in any
 * of the pre-payment states. When the order reaches `id_verified`, it POSTs
 * to /api/checkout/session and redirects the user to Clover hosted checkout.
 */
export function OrderStatusPoller({
  orderId,
  initialStatus,
}: OrderStatusPollerProps) {
  const { clearCart } = useCart();
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [pollCount, setPollCount] = useState(0);
  const checkoutTriggered = useRef(false);

  const isPolling = POLLING_STATES.has(status) && pollCount < MAX_POLLS;

  // When ID is verified, request a Clover hosted-checkout session and redirect.
  useEffect(() => {
    if (status !== 'id_verified' || checkoutTriggered.current) return;
    checkoutTriggered.current = true;

    void (async () => {
      try {
        const res = await fetch('/api/checkout/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
        const data = (await res.json()) as { redirectUrl?: string };
        if (res.ok && data.redirectUrl) {
          window.location.assign(data.redirectUrl);
        }
      } catch {
        // Surface failure on next poll cycle; user can retry from the page.
        checkoutTriggered.current = false;
      }
    })();
  }, [status, orderId]);

  useEffect(() => {
    if (!isPolling) {
      if (status === 'paid') clearCart();
      return;
    }

    const timer = setTimeout(() => {
      void fetchOrderStatus(orderId).then(nextStatus => {
        if (nextStatus) setStatus(nextStatus);
        setPollCount(c => c + 1);
      });
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [status, pollCount, isPolling, orderId, clearCart]);

  if (!isPolling) return null;

  const message =
    status === 'id_verified'
      ? 'ID verified — opening payment…'
      : 'Payment processing…';

  return (
    <div
      className="order-polling-indicator"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="order-spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
