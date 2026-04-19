import { buildMetadata } from '@/lib/seo/metadata.factory';

export const metadata = buildMetadata('/shipping', {
  title: 'Shipping & Returns — Rush N Relax',
  description:
    'Rush N Relax shipping policy, delivery timelines, and return procedures for hemp and CBD products.',
  path: '/shipping',
  noindex: true,
});

export default function ShippingPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero asymmetry-section-stable page-hero-shell">
        <div className="container">
          <h1>Shipping &amp; Returns</h1>
          <p className="lead">Last updated: April 16, 2026</p>
        </div>
      </section>

      <section className="legal-content asymmetry-section-stable">
        <div className="container">
          <h2>Shipping Policy</h2>

          <h3>Processing Time</h3>
          <p>
            Orders are processed within 1–2 business days (Monday–Friday,
            excluding holidays). You will receive an email confirmation with
            tracking information once your order ships.
          </p>

          <h3>Shipping Methods &amp; Timelines</h3>
          <p>
            We currently ship within the United States to states where
            hemp-derived products are legally permitted. Estimated delivery
            times:
          </p>
          <ul>
            <li>Standard (USPS First Class / UPS Ground): 3–7 business days</li>
            <li>Expedited (UPS 2-Day): 2 business days</li>
          </ul>
          <p>
            Rush N Relax is not responsible for delays caused by the carrier,
            weather, or events outside our control.
          </p>

          <h3>Shipping Restrictions</h3>
          <p>
            We cannot ship to states where hemp-derived cannabinoid products are
            prohibited by state law. It is the customer's responsibility to know
            their local regulations before ordering. Orders placed to restricted
            states will be refunded.
          </p>

          <h3>Shipping Rates</h3>
          <p>
            Shipping rates are calculated at checkout based on order weight and
            destination. Orders over $75 qualify for free standard shipping
            within the contiguous United States.
          </p>

          <h2>Returns &amp; Refunds</h2>

          <h3>Satisfaction Guarantee</h3>
          <p>
            If you are not satisfied with your purchase, contact us within 30
            days of delivery. We will work with you to make it right — whether
            that's a replacement, store credit, or a refund.
          </p>

          <h3>Return Eligibility</h3>
          <p>
            Due to the nature of hemp and CBD products, we cannot accept returns
            of opened consumable items (tinctures, edibles, vape products)
            unless the product is defective or damaged in transit. Unopened
            items may be returned within 30 days of purchase in original
            packaging.
          </p>

          <h3>How to Initiate a Return</h3>
          <p>
            To start a return or report a damaged item, please contact us
            through our <a href="/contact">contact page</a> with your order
            number and a description of the issue. Do not return items without
            first contacting us, as unauthorized returns cannot be processed.
          </p>

          <h3>Refund Processing</h3>
          <p>
            Approved refunds are issued to the original payment method within
            5–10 business days. Shipping charges are non-refundable unless the
            return is due to our error.
          </p>
        </div>
      </section>
    </main>
  );
}
