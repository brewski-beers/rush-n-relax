'use client';

/**
 * Client island — polls /api/order/[id]/status every 5s for up to 30s.
 * Renders only when the initial server-read status is "pending" or "processing".
 * On terminal status, triggers a full page reload so the server component
 * re-fetches and renders the correct paid/failed state.
 */
import { useEffect, useRef } from 'react';

interface Props {
  orderId: string;
}

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_DURATION_MS = 30_000;

export function OrderStatusPoller({ orderId }: Props) {
  // startTime is set inside useEffect to avoid calling Date.now() during render
  const startTime = useRef<number>(0);

  useEffect(() => {
    startTime.current = Date.now();

    const poll = (): void => {
      const elapsed = Date.now() - startTime.current;
      if (elapsed >= MAX_POLL_DURATION_MS) {
        clearInterval(interval);
        return;
      }

      fetch(`/api/order/${orderId}/status`)
        .then(async res => {
          if (!res.ok) {
            clearInterval(interval);
            return;
          }
          const body = (await res.json()) as { status: string };
          if (body.status !== 'pending' && body.status !== 'processing') {
            clearInterval(interval);
            window.location.reload();
          }
        })
        .catch(() => {
          // Network error — stop polling silently
          clearInterval(interval);
        });
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [orderId]);

  return (
    <div className="order-processing">
      <div className="order-processing__spinner" aria-hidden="true" />
      <p>Payment processing&hellip;</p>
      <p className="order-processing__subtext">
        This page will update automatically.
      </p>
    </div>
  );
}
