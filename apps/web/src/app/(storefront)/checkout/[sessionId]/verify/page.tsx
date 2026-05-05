import { redirect } from 'next/navigation';
import { getCheckoutSession } from '@/lib/repositories/checkout-session.repository';
import { formatCents } from '@/utils/currency';
import { TestModeBanner } from '@/components/TestModeBanner';
import { VerifyClient } from './VerifyClient';

interface Props {
  params: Promise<{ sessionId: string }>;
}

export const dynamic = 'force-dynamic';

/**
 * /checkout/[sessionId]/verify — ID verification step (#365).
 *
 * Loads the CheckoutSession and renders an order summary plus a
 * "Proceed to Payment" button bound to the AgeChecker popup. The popup
 * intercepts the first click; once the user completes verification the
 * AgeChecker webhook flips the session to `awaiting_payment` and the
 * button click navigates to the Clover redirect endpoint.
 *
 * Expired/missing/terminal sessions redirect to /cart.
 */
export default async function CheckoutVerifyPage({ params }: Props) {
  const { sessionId } = await params;
  const session = await getCheckoutSession(sessionId);

  if (!session) {
    redirect('/cart?toast=session-missing');
  }

  const expired =
    session.expiresAt instanceof Date &&
    session.expiresAt < new Date();

  // Only `awaiting_id` and `awaiting_payment` are still actionable on this
  // page. Once verified, the popup binding is harmless (no element bound).
  const terminal =
    session.status === 'completed' ||
    session.status === 'cancelled' ||
    session.status === 'expired';

  if (expired || terminal) {
    redirect('/cart?toast=session-expired');
  }

  const apiKey = process.env.NEXT_PUBLIC_AGECHECKER_API_KEY ?? '';
  // Per AgeChecker docs the redirect target is where the popup hands the
  // customer once verification completes. The session id is enough — the
  // server route resolves the session and forwards to Clover.
  const redirectUrl = `/api/checkout/${session.id}/redirect`;

  return (
    <main className="checkout-verify-page">
      <TestModeBanner />
      <div className="container">
        <h1>Confirm Your Order</h1>
        <p>Verify your ID to continue to payment.</p>

        <section aria-label="Order summary" className="order-summary">
          <h2>Order Summary</h2>
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
              {session.items.map((item, i) => (
                <tr key={`${item.productId}-${item.variantId}-${i}`}>
                  <td>{item.productName}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCents(item.unitPrice)}</td>
                  <td>{formatCents(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Subtotal</td>
                <td>{formatCents(session.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3}>Tax</td>
                <td>{formatCents(session.tax)}</td>
              </tr>
              <tr>
                <td colSpan={3}>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>{formatCents(session.total)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section aria-label="Delivery address" className="delivery-address">
          <h2>Delivering To</h2>
          <address>
            {session.deliveryAddress.name}
            <br />
            {session.deliveryAddress.line1}
            {session.deliveryAddress.line2
              ? `, ${session.deliveryAddress.line2}`
              : ''}
            <br />
            {session.deliveryAddress.city}, {session.deliveryAddress.state}{' '}
            {session.deliveryAddress.zip}
          </address>
        </section>

        <VerifyClient
          sessionId={session.id}
          apiKey={apiKey}
          customerEmail={session.customerEmail}
          redirectUrl={redirectUrl}
        />

        {/* Anti-bypass: AgeChecker requires a noscript meta-refresh that
            kicks the visitor out if JavaScript is disabled, since the
            popup cannot enforce verification without JS. */}
        <noscript>
          <meta httpEquiv="refresh" content="0; url=/cart?toast=js-required" />
        </noscript>
      </div>
    </main>
  );
}
