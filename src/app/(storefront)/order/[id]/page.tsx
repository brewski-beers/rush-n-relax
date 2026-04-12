import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrder } from '@/lib/repositories';
import { OrderStatusPoller } from './OrderStatusPoller';

// TODO(#69): import { useCart } from '@/context/CartContext';
// Cart clearing on paid state requires CartContext from issue #69.
// The ClearCart component below is a stub until CartContext is available.

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Stub: clears the cart when CartContext (#69) is built.
 * Replace with a real client component that calls useCart().clearCart().
 */
function ClearCart() {
  // TODO(#69): implement cart clearing
  return null;
}

export const dynamic = 'force-dynamic';

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) notFound();

  const { status } = order;

  // ── Pending / Processing — show spinner + client poller ───────────────────
  if (status === 'pending' || status === 'processing') {
    return (
      <main className="order-confirmation">
        <div className="container">
          <OrderStatusPoller orderId={id} />
        </div>
      </main>
    );
  }

  // ── Paid — success state ──────────────────────────────────────────────────
  if (status === 'paid') {
    return (
      <main className="order-confirmation order-confirmation--paid">
        <ClearCart />
        <div className="container">
          <h1>Order Confirmed</h1>
          <p className="order-confirmation__id">Order ID: {id}</p>

          <section className="order-confirmation__items">
            <h2>Your Items</h2>
            <ul>
              {order.items.map((item, idx) => (
                <li key={idx}>
                  {item.productName} &times; {item.quantity} &mdash; $
                  {(item.lineTotal / 100).toFixed(2)}
                </li>
              ))}
            </ul>
          </section>

          <p className="order-confirmation__total">
            <strong>Total: ${(order.total / 100).toFixed(2)}</strong>
          </p>

          <Link href="/products" className="btn btn--primary">
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  if (status === 'failed') {
    return (
      <main className="order-confirmation order-confirmation--failed">
        <div className="container">
          <h1>Payment Failed</h1>
          <p>Something went wrong processing your payment. Please try again.</p>
          <Link href="/cart" className="btn btn--secondary">
            Return to Cart
          </Link>
        </div>
      </main>
    );
  }

  // ── Voided / Refunded — informational ─────────────────────────────────────
  return (
    <main className="order-confirmation order-confirmation--info">
      <div className="container">
        <h1>Order Update</h1>
        <p>
          This order has been {status === 'refunded' ? 'refunded' : 'voided'}.
          If you have questions, please <Link href="/contact">contact us</Link>.
        </p>
        <Link href="/products" className="btn btn--secondary">
          Continue Shopping
        </Link>
      </div>
    </main>
  );
}
