import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrder } from '@/lib/repositories';
import { formatCents } from '@/utils/currency';
import { OrderStatusPoller } from './OrderStatusPoller';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) notFound();

  const isPendingOrProcessing =
    order.status === 'pending' || order.status === 'processing';

  return (
    <main className="order-confirmation-page">
      <div className="container">
        {/* ── Pending / Processing ──────────────────────────────── */}
        {isPendingOrProcessing && (
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

        {/* ── Paid ─────────────────────────────────────────────── */}
        {order.status === 'paid' && (
          <section className="order-status order-status--paid">
            <h1>Order Confirmed!</h1>
            <p className="order-confirmation-msg">
              Thank you for your order. Your order ID is{' '}
              <strong>{order.id}</strong>.
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

        {/* ── Failed ───────────────────────────────────────────── */}
        {order.status === 'failed' && (
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

        {/* ── Voided / Refunded ─────────────────────────────────── */}
        {(order.status === 'voided' || order.status === 'refunded') && (
          <section className="order-status order-status--voided">
            <h1>
              {order.status === 'voided' ? 'Order Voided' : 'Order Refunded'}
            </h1>
            <p>
              {order.status === 'voided'
                ? 'This order has been voided and no charge was made.'
                : 'Your refund has been processed. Please allow a few business days for it to appear.'}
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
