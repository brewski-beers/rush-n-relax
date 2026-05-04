export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { getOrder, listOrderEvents } from '@/lib/repositories';
import type { OrderStatus } from '@/types';
import { AdminOrderActions } from './AdminOrderActions';
import { ResendEmailButton } from './ResendEmailButton';

interface Props {
  params: Promise<{ id: string }>;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Mirror of the order.repository STATUS_TO_EMAIL_TEMPLATE keys — used to
// decide whether a "Resend email" button should be rendered for a given
// event-log row. Must stay in sync with the repository.
const RESENDABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'pending_id_verification',
  'id_verified',
  'id_rejected',
  'paid',
  'preparing',
  'out_for_delivery',
  'completed',
  'cancelled',
  'refunded',
]);

export default async function AdminOrderDetailPage({ params }: Props) {
  await requireRole('staff');
  const { id } = await params;

  const order = await getOrder(id);
  if (!order) notFound();

  const events = await listOrderEvents(id);

  const addr = order.deliveryAddress;

  return (
    <>
      <div className="admin-page-header">
        <h1>
          Order {order.id}
          {order.testMode ? (
            <span
              className="admin-status-badge admin-test-badge"
              data-testid="test-badge"
            >
              TEST
            </span>
          ) : null}
        </h1>
        <Link href="/admin/orders" className="admin-btn-secondary">
          ← Back to orders
        </Link>
      </div>

      <section className="admin-section">
        <h2>Status</h2>
        <p>
          <span className={`admin-status-badge admin-status-${order.status}`}>
            {order.status}
          </span>
        </p>
        <AdminOrderActions
          order={{
            id: order.id,
            status: order.status,
            cloverPaymentId: order.cloverPaymentId,
            total: order.total,
          }}
        />
      </section>

      <section className="admin-section">
        <h2>Customer</h2>
        <dl className="admin-dl">
          <dt>Email</dt>
          <dd>{order.customerEmail ?? '—'}</dd>
          <dt>Location</dt>
          <dd>{order.locationId}</dd>
          <dt>Created</dt>
          <dd>{order.createdAt.toLocaleString()}</dd>
          <dt>Updated</dt>
          <dd>{order.updatedAt.toLocaleString()}</dd>
        </dl>
      </section>

      <section className="admin-section">
        <h2>Delivery address</h2>
        <address>
          {addr.name}
          <br />
          {addr.line1}
          {addr.line2 ? (
            <>
              <br />
              {addr.line2}
            </>
          ) : null}
          <br />
          {addr.city}, {addr.state} {addr.zip}
        </address>
      </section>

      <section className="admin-section">
        <h2>Items</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={`${item.productId}-${i}`}>
                  <td>{item.productName}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCents(item.unitPrice)}</td>
                  <td>{formatCents(item.lineTotal)}</td>
                </tr>
              ))}
              {order.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-empty">
                    No line items recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <dl className="admin-dl">
          <dt>Subtotal</dt>
          <dd>{formatCents(order.subtotal)}</dd>
          <dt>Tax</dt>
          <dd>{formatCents(order.tax)}</dd>
          <dt>Total</dt>
          <dd>{formatCents(order.total)}</dd>
        </dl>
      </section>

      <section className="admin-section">
        <h2>Provider references</h2>
        <dl className="admin-dl">
          <dt>Clover payment ID</dt>
          <dd>{order.cloverPaymentId ?? '—'}</dd>
          <dt>Clover checkout session ID</dt>
          <dd>{order.cloverCheckoutSessionId ?? '—'}</dd>
          <dt>AgeChecker session ID</dt>
          <dd>{order.agecheckerSessionId ?? '—'}</dd>
        </dl>
      </section>

      <section className="admin-section">
        <h2>Event log</h2>
        {events.length === 0 ? (
          <p className="admin-empty">No events recorded yet.</p>
        ) : (
          <ol className="admin-timeline">
            {events.map(ev => (
              <li key={ev.id}>
                <time dateTime={ev.createdAt.toISOString()}>
                  {ev.createdAt.toLocaleString()}
                </time>
                <div>
                  <strong>
                    {ev.from ?? '∅'} → {ev.to}
                  </strong>
                  <span className="admin-timeline-actor"> · {ev.actor}</span>
                  <ResendEmailButton
                    orderId={order.id}
                    eventId={ev.id}
                    enabled={RESENDABLE_STATUSES.has(ev.to)}
                  />
                </div>
                {ev.meta ? (
                  <pre className="admin-timeline-meta">
                    {JSON.stringify(ev.meta, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
