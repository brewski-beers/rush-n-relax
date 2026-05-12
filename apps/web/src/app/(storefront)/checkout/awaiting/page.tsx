import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ session?: string }>;
}

/**
 * /checkout/awaiting — holding page (#audit B4).
 *
 * Shown when the customer returns from Clover before Clover has linked an
 * order to the checkout session (the `/order/[id]/return` route's
 * `awaiting` outcome), or during the brief `in_flight` promotion window on
 * a refresh. The `reconcileCheckoutSessions` cron finishes the promotion
 * within a few minutes and the confirmation email follows — the customer
 * does not need to refresh or pay again. We expose a "check status" link
 * back through the return route so they can re-trigger the lookup manually.
 *
 * (Follow-up polish: client-side poll of `/order/{session}/return` with a
 * cap, so the page advances to `/order/{orderId}` automatically.)
 */
export default async function CheckoutAwaitingPage({ searchParams }: Props) {
  const { session } = await searchParams;

  return (
    <main className="checkout-status-page">
      <div className="container">
        <h1>Payment processing…</h1>
        <p>
          We&apos;ve received your payment and we&apos;re finalizing your order.
          This usually takes about a minute. You&apos;ll get a confirmation
          email as soon as it&apos;s ready — there&apos;s no need to refresh or
          pay again.
        </p>
        <p>
          {session ? (
            <Link href={`/order/${encodeURIComponent(session)}/return`}>
              Check order status
            </Link>
          ) : (
            <Link href="/">Return to the store</Link>
          )}
        </p>
      </div>
    </main>
  );
}
