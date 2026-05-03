'use client';

/**
 * Admin order actions (#283) — client UI for the order detail page.
 *
 * Renders only the destination states allowed by ALLOWED_TRANSITIONS for
 * the order's current status. Calls the matching Server Action. Cancel and
 * refund are gated behind a window.confirm() guard. Refund additionally
 * shows the Clover payment id + amount in the prompt.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ALLOWED_TRANSITIONS, type Order, type OrderStatus } from '@/types';
import { refundOrderAction, transitionOrderAction } from './actions';

interface Props {
  order: Pick<Order, 'id' | 'status' | 'cloverPaymentId' | 'total'>;
}

const DESTRUCTIVE_TRANSITIONS: ReadonlySet<OrderStatus> = new Set([
  'cancelled',
  'refunded',
  'failed',
]);

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdminOrderActions({ order }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allowedNext = ALLOWED_TRANSITIONS[order.status] ?? [];

  function runTransition(to: OrderStatus) {
    setError(null);
    if (DESTRUCTIVE_TRANSITIONS.has(to)) {
      const ok = window.confirm(
        `Confirm transition: ${order.status} → ${to}? This is destructive.`
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const res = await transitionOrderAction(order.id, to);
      if (!res.ok) setError(res.error ?? 'Transition failed');
      else router.refresh();
    });
  }

  function runRefund() {
    setError(null);
    const ok = window.confirm(
      `Refund Clover payment ${order.cloverPaymentId ?? '(none)'} for ${formatCents(
        order.total
      )}? This is irreversible.`
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await refundOrderAction(order.id);
      if (!res.ok) setError(res.error ?? 'Refund failed');
      else router.refresh();
    });
  }

  const showRefund = order.status === 'paid';

  return (
    <div data-testid="admin-order-actions" className="admin-order-actions">
      <div className="admin-order-actions__row">
        {allowedNext.map(to => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => runTransition(to)}
            data-testid={`transition-btn-${to}`}
            className={
              DESTRUCTIVE_TRANSITIONS.has(to)
                ? 'admin-btn-danger'
                : 'admin-btn-secondary'
            }
          >
            → {to}
          </button>
        ))}
        {allowedNext.length === 0 ? (
          <span className="admin-empty">
            No transitions available from {order.status}.
          </span>
        ) : null}
      </div>
      {showRefund ? (
        <div className="admin-order-actions__row">
          <button
            type="button"
            disabled={pending}
            onClick={runRefund}
            data-testid="refund-btn"
            className="admin-btn-danger"
          >
            Refund payment
          </button>
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="admin-error"
          data-testid="admin-action-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
