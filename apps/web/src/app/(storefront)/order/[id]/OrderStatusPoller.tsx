'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/useCart';
import type { OrderStatus } from '@/types';

interface OrderStatusPollerProps {
  orderId: string;
  /** Initial status from server render — only awaiting_payment triggers polling */
  initialStatus: OrderStatus;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 6; // 30s max

async function fetchOrderStatus(orderId: string): Promise<OrderStatus | null> {
  const res = await fetch(`/api/order/${orderId}/status`);
  if (!res.ok) return null;
  // Justified cast: API contract returns { status: OrderStatus }
  const data = (await res.json()) as { status: OrderStatus };
  return data.status;
}

const POLLING_STATES: ReadonlySet<OrderStatus> = new Set([
  'awaiting_payment',
]);

/**
 * Client island that polls /api/order/[id]/status until the order leaves
 * the awaiting_payment state. Clears the cart on 'paid'.
 */
export function OrderStatusPoller({
  orderId,
  initialStatus,
}: OrderStatusPollerProps) {
  const { clearCart } = useCart();
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [pollCount, setPollCount] = useState(0);

  const isPolling = POLLING_STATES.has(status) && pollCount < MAX_POLLS;

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

  return (
    <div
      className="order-polling-indicator"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="order-spinner" aria-hidden="true" />
      <span>Payment processing…</span>
    </div>
  );
}
