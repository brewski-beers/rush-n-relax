import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * /checkout/cancelled — shown when a checkout was declined, the customer
 * cancelled on Clover, or a post-payment commit failed (the
 * `/order/[id]/return` route's `declined` / `commit-failed` outcomes, and
 * the Clover Hosted Checkout `redirectUrls.failure` target). By the time
 * the customer lands here the CheckoutSession is `cancelled` and its stock
 * holds have been released — the client cart is untouched, so they can
 * retry immediately.
 */
export default function CheckoutCancelledPage() {
  return (
    <main className="checkout-status-page">
      <div className="container">
        <h1>Checkout cancelled</h1>
        <p>
          Your payment didn&apos;t go through and you weren&apos;t charged. Your
          cart is still here — head back and try again whenever you&apos;re
          ready.
        </p>
        <p>
          <Link href="/cart">Return to cart</Link>
        </p>
      </div>
    </main>
  );
}
