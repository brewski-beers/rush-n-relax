import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrder } from '@/lib/repositories';
import { formatCents } from '@/utils/currency';
import type { OrderStatus } from '@/types';
import { OrderStatusPoller } from './OrderStatusPoller';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

const IN_PROGRESS_STATES: ReadonlySet<OrderStatus> = new Set([
  'paid',
  'preparing',
  'out_for_delivery',
]);

const TERMINATED_STATES: ReadonlySet<OrderStatus> = new Set([
  'cancelled',
  'id_rejected',
]);

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) notFound();

  const showPoller =
    order.status === 'pending_id_verification' ||
    order.status === 'awaiting_payment';
  const showInProgress = IN_PROGRESS_STATES.has(order.status);
  const showCompleted = order.status === 'completed';
  const showFailed = order.status === 'failed';
  const showTerminated = TERMINATED_STATES.has(order.status);
  const showRefunded = order.status === 'refunded';

  return (
    <main className="order-confirmation-page">
      <div className="container">
        {/* ── Awaiting payment / verification ─────────────────────── */}
        {showPoller && (
          <section className="order-status order-status--pending">
            <h1>Order Received</h1>
            <p>
              Your payment is being processed. This page will update
              automatically.
            </p>
            <OrderStatusPoller
              orderId={order.id}
              initialStatus={order.status}
            />
          </section>
        )}

        {/* ── Paid / Preparing / Out for delivery ─────────────────── */}
        {showInProgress && (
          <section className="order-status order-status--paid">
            <h1>Order Confirmed!</h1>
            <p className="order-confirmation-msg">
              Thank you for your order. Your order ID is{' '}
              <strong>{order.id}</strong>.
            </p>
            <p className="order-status-stage">
              Current status:{' '}
              <strong>{order.status.replace(/_/g, ' ')}</strong>
            </p>

            <table className="order-items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  /* items have no unique slug — use index as key */
                  <tr key={`${item.productId}-${i}`}>
                    <td>{item.productName}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCents(item.unitPrice)}</td>
                    <td>{formatCents(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>{formatCents(order.total)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>

            <Link href="/products" className="btn btn-primary">
              Continue Shopping
            </Link>
          </section>
        )}

        {/* ── Completed ───────────────────────────────────────────── */}
        {showCompleted && (
          <section className="order-status order-status--paid">
            <h1>Delivered</h1>
            <p>Your order was delivered. Thanks for shopping with us.</p>
            <Link href="/products" className="btn btn-primary">
              Shop Again
            </Link>
          </section>
        )}

        {/* ── Failed ───────────────────────────────────────────── */}
        {showFailed && (
          <section className="order-status order-status--failed">
            <h1>Payment Failed</h1>
            <p>
              We were unable to process your payment. Please check your payment
              details and try again.
            </p>
            <Link href="/cart" className="btn btn-primary">
              Return to Cart
            </Link>
          </section>
        )}

        {/* ── Cancelled / ID rejected ─────────────────────────────── */}
        {showTerminated && (
          <section className="order-status order-status--voided">
            <h1>
              {order.status === 'id_rejected'
                ? 'ID Verification Failed'
                : 'Order Cancelled'}
            </h1>
            <p>
              {order.status === 'id_rejected'
                ? 'We were unable to verify your ID. No charge was made.'
                : 'This order has been cancelled and no charge was made.'}
            </p>
            <Link href="/products" className="btn btn-secondary">
              Browse Products
            </Link>
          </section>
        )}

        {/* ── Refunded ────────────────────────────────────────────── */}
        {showRefunded && (
          <section className="order-status order-status--voided">
            <h1>Order Refunded</h1>
            <p>
              Your refund has been processed. Please allow a few business days
              for it to appear.
            </p>
            <Link href="/products" className="btn btn-secondary">
              Browse Products
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
