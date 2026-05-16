import { buildMetadata } from '@/lib/seo/metadata.factory';

export const metadata = buildMetadata('/shipping', {
  title: 'Shipping & Returns — Rush N Relax',
  description:
    'Rush N Relax shipping policy, delivery timelines, and return procedures for hemp and CBD products.',
  path: '/shipping',
});

const EFFECTIVE = 'May 16, 2026';

export default function ShippingPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero asymmetry-section-stable page-hero-shell">
        <div className="container">
          <h1>Shipping &amp; Returns</h1>
          <p className="lead">
            Effective {EFFECTIVE} · Last Updated {EFFECTIVE}
          </p>
        </div>
      </section>

      <section className="legal-content asymmetry-section-stable">
        <div className="container">
          <p>
            This Shipping &amp; Returns Policy describes how Rush N Relax
            (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) ships
            orders and how we handle returns, refunds, and exchanges. By placing
            an order, you agree to the terms below, which are incorporated into
            our <a href="/terms">Terms &amp; Conditions</a>.
          </p>

          <h2>1. Order Processing</h2>
          <ul>
            <li>
              Orders are processed Monday through Friday, excluding U.S. federal
              holidays.
            </li>
            <li>
              Most orders ship within <strong>1&ndash;2 business days</strong>{' '}
              of payment confirmation and successful age verification.
            </li>
            <li>
              Orders placed after 12:00 PM ET on a business day, or on
              weekends/holidays, begin processing the next business day.
            </li>
            <li>
              You will receive an email with tracking information once your
              order ships.
            </li>
          </ul>

          <h2>2. Shipping Methods &amp; Rates</h2>
          <p>We offer the following shipping options at checkout:</p>
          <ul>
            <li>
              <strong>Standard Shipping</strong> &mdash; typically 3&ndash;7
              business days
            </li>
            <li>
              <strong>Expedited Shipping</strong> &mdash; typically 2&ndash;3
              business days (where available)
            </li>
          </ul>
          <p>
            Shipping costs are calculated at checkout based on destination,
            weight, and selected service. Free or promotional shipping may be
            offered at our discretion.
          </p>

          <h2>3. Shipping Restrictions</h2>
          <p>
            We ship only within the United States. We do not ship to states or
            localities where our products are prohibited or restricted by law.
            If you place an order to a restricted destination, we will cancel
            the order and refund the purchase price.
          </p>
          <p>
            An adult{' '}
            <strong>
              21 years of age or older with a valid government-issued ID
            </strong>{' '}
            must be present to sign for delivery. Carriers may refuse delivery
            if no eligible recipient is available.
          </p>

          <h2>4. Carrier Delays</h2>
          <p>
            Once a package is in the carrier&rsquo;s possession, delivery is
            subject to the carrier&rsquo;s terms and schedules.{' '}
            <strong>
              Rush N Relax is not responsible for carrier delays, missed
              delivery windows, or service disruptions caused by weather,
              holidays, labor actions, mechanical issues, or other circumstances
              beyond our control.
            </strong>{' '}
            Estimated transit times are not guaranteed.
          </p>

          <h2>5. Refused, Undeliverable &amp; Returned-to-Sender Packages</h2>
          <p>
            If a package is returned to Rush N Relax because of any of the
            following &mdash; invalid or incomplete address provided at
            checkout, refusal of delivery by the recipient, failure to be
            present for adult-signature delivery after repeated carrier
            attempts, age-verification failure at the door, or any other reason
            within the customer&rsquo;s control &mdash; the following applies:
          </p>
          <ul>
            <li>
              <strong>Original shipping charges are non-refundable.</strong>
            </li>
            <li>
              A refund for the product price, less original shipping and a
              restocking fee where applicable, will be issued only after the
              package is received back in its original sealed, unused condition.
            </li>
            <li>
              <strong>
                Reshipment requires payment of new shipping charges by the
                customer.
              </strong>{' '}
              We will not reship at our expense.
            </li>
            <li>
              If the package cannot be reshipped due to a restricted shipping
              destination, only the product price (less original shipping and
              any restocking fee) will be refunded.
            </li>
          </ul>

          <h2>6. Lost, Stolen, or Damaged Packages</h2>
          <ul>
            <li>
              If a package is marked &ldquo;delivered&rdquo; by the carrier but
              cannot be located, please contact the carrier first to open a
              delivery inquiry, then contact us so we may assist where possible.
            </li>
            <li>
              If your package arrives damaged, contact us within{' '}
              <strong>7 days of delivery</strong> with photos of the damaged
              packaging and product. We will work with the carrier to resolve
              the issue and, where appropriate, replace the affected items.
            </li>
            <li>
              If a package is lost in transit (no delivery scan within 10
              business days of the expected delivery date), contact us and we
              will open a carrier investigation on your behalf.
            </li>
          </ul>

          <h2>7. Returns</h2>
          <p>
            Due to the nature of our products and applicable health, safety, and
            regulatory requirements, <strong>all sales are final</strong>. We do
            not accept returns or exchanges of opened, used, or unsealed
            products.
          </p>
          <p>
            We will accept returns only in the following limited circumstances:
          </p>
          <ul>
            <li>
              The product arrived damaged or defective; <strong>or</strong>
            </li>
            <li>You received the wrong item due to our error.</li>
          </ul>
          <p>
            To request a return under these conditions, contact us within{' '}
            <strong>7 days of delivery</strong> at the address in Section 11.
            Include your order number, a description of the issue, and
            photographs. Do not ship the product back until we provide return
            instructions and a return authorization.
          </p>
          <p>
            Returned items must be{' '}
            <strong>unused, unopened, and in their original packaging</strong>.
            Returns received without prior authorization may be refused.
          </p>

          <h2>8. Refunds</h2>
          <ul>
            <li>
              Approved refunds will be issued to the original payment method
              within <strong>5&ndash;10 business days</strong> after we receive
              and inspect the returned item, or after we approve a no-return
              refund at our discretion.
            </li>
            <li>
              Original shipping charges are non-refundable, except where the
              return is due to our error.
            </li>
            <li>
              You are responsible for return shipping costs unless the return is
              due to a damaged, defective, or incorrect item.
            </li>
          </ul>

          <h2>9. Lab Testing &amp; Certificates of Analysis</h2>
          <p>
            All hemp-derived products sold by Rush N Relax are tested by
            independent third-party laboratories for cannabinoid content and
            contaminants in accordance with the 2018 Farm Bill and applicable
            Tennessee law. Certificates of Analysis (COAs) are available upon
            request and may be linked on individual product pages.
          </p>

          <h2>10. Cancellations</h2>
          <p>
            You may request cancellation of an order before it has been
            processed for shipping. Once an order has shipped, it cannot be
            cancelled and is subject to the return terms above. Contact us as
            soon as possible to request a cancellation; we cannot guarantee
            cancellation requests received after order processing has begun.
          </p>

          <h2>11. Contact Us</h2>
          <p>For shipping, return, or refund questions, contact us at:</p>
          <address>
            <strong>Rush N Relax</strong>
            <br />
            110 Bus Terminal Rd
            <br />
            Oak Ridge, TN 37830
            <br />
            Email: <a href="mailto:rush@rushnrelax.com">rush@rushnrelax.com</a>
            <br />
            Phone: <a href="tel:+18659363069">+1 (865) 936-3069</a>
            <br />
            Hours: 10:00 AM &ndash; 10:00 PM ET, 7 days a week
          </address>
        </div>
      </section>
    </main>
  );
}
