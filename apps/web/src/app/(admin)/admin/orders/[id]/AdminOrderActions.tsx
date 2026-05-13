'use client';

/**
 * Admin order actions (#283) — client UI for the order detail page.
 *
 * Renders only the destination states allowed by ALLOWED_TRANSITIONS for
 * the order's current status. Calls the matching Server Action.
 *
 * Destructive transitions (cancel, refund) are gated behind the accessible
 * AdminConfirmDialog (#440) instead of native window.confirm. The dialog
 * implements role="alertdialog", focus trap, ESC-to-cancel, and focus restore.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ALLOWED_TRANSITIONS, type Order, type OrderStatus } from '@/types';
import { formatOrderStatus } from '@/lib/orders/formatOrderStatus';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { refundOrderAction, transitionOrderAction } from './actions';

interface Props {
  order: Pick<Order, 'id' | 'status' | 'cloverPaymentId' | 'total'>;
}

const DESTRUCTIVE_TRANSITIONS: ReadonlySet<OrderStatus> = new Set([
  'cancelled',
  'refunded',
]);

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type PendingConfirm =
  | { kind: 'transition'; to: OrderStatus }
  | { kind: 'refund' }
  | null;

export function AdminOrderActions({ order }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);

  const allowedNext = ALLOWED_TRANSITIONS[order.status] ?? [];

  function executeTransition(to: OrderStatus) {
    startTransition(async () => {
      const res = await transitionOrderAction(order.id, to);
      if (!res.ok) setError(res.error ?? 'Transition failed');
      else router.refresh();
    });
  }

  function executeRefund() {
    startTransition(async () => {
      const res = await refundOrderAction(order.id);
      if (!res.ok) setError(res.error ?? 'Refund failed');
      else router.refresh();
    });
  }

  function runTransition(to: OrderStatus) {
    setError(null);
    if (DESTRUCTIVE_TRANSITIONS.has(to)) {
      setConfirm({ kind: 'transition', to });
      return;
    }
    executeTransition(to);
  }

  function runRefund() {
    setError(null);
    setConfirm({ kind: 'refund' });
  }

  function handleConfirm() {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    if (c.kind === 'transition') executeTransition(c.to);
    else executeRefund();
  }

  function handleCancel() {
    setConfirm(null);
  }

  const showRefund = order.status === 'paid';

  let dialogTitle = '';
  let dialogMessage = '';
  let confirmLabel = 'Confirm';
  if (confirm?.kind === 'transition') {
    dialogTitle = 'Confirm destructive transition';
    dialogMessage = `Transition order from ${formatOrderStatus(order.status)} to ${formatOrderStatus(confirm.to)}? This is destructive.`;
    confirmLabel = formatOrderStatus(confirm.to);
  } else if (confirm?.kind === 'refund') {
    dialogTitle = 'Refund payment';
    dialogMessage = `Refund Clover payment ${order.cloverPaymentId ?? '(none)'} for ${formatCents(order.total)}? This is irreversible.`;
    confirmLabel = 'Refund';
  }

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
            → {formatOrderStatus(to)}
          </button>
        ))}
        {allowedNext.length === 0 ? (
          <span className="admin-empty">
            No transitions available from {formatOrderStatus(order.status)}.
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
      <AdminConfirmDialog
        open={confirm !== null}
        title={dialogTitle}
        message={dialogMessage}
        confirmLabel={confirmLabel}
        destructive
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
