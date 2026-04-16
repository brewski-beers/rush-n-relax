import { buildMetadata } from '@/lib/seo/metadata.factory';

export const metadata = buildMetadata('/terms', {
  title: 'Terms & Conditions — Rush N Relax',
  description:
    'Terms and conditions governing your use of the Rush N Relax website and purchase of hemp and CBD products.',
  path: '/terms',
  noindex: true,
});

/**
 * PLACEHOLDER — Legal copy must be reviewed and finalized by KB before launch.
 */
export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero asymmetry-section-stable page-hero-shell">
        <div className="container">
          <h1>Terms &amp; Conditions</h1>
          <p className="lead">
            Last updated: June 2025 (placeholder — pending legal review)
          </p>
        </div>
      </section>

      <section className="legal-content asymmetry-section-stable">
        <div className="container">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the Rush N Relax website and purchasing
            products from any of our locations, you agree to be bound by these
            Terms and Conditions. If you do not agree, please discontinue use
            immediately.
          </p>

          <h2>2. Age Requirement</h2>
          <p>
            All products sold by Rush N Relax are intended for adults 21 years
            of age or older. By using this site or entering any Rush N Relax
            location, you confirm that you meet this age requirement. We reserve
            the right to require proof of age at any time.
          </p>

          <h2>3. Hemp and CBD Products</h2>
          <p>
            Rush N Relax sells hemp-derived products compliant with the 2018
            Farm Bill, containing no more than 0.3% Delta-9 THC by dry weight.
            These statements have not been evaluated by the Food and Drug
            Administration. Our products are not intended to diagnose, treat,
            cure, or prevent any disease. Consult a licensed healthcare
            professional before use, especially if you are pregnant, nursing, or
            taking prescription medications.
          </p>

          <h2>4. Purchases and Pricing</h2>
          <p>
            Prices listed on our website are subject to change without notice.
            Rush N Relax reserves the right to cancel or refuse any order at our
            discretion. In the event of a pricing error, we will notify you
            before processing payment.
          </p>

          <h2>5. Intellectual Property</h2>
          <p>
            All content on this website — including text, images, logos, and
            design — is the property of Rush N Relax and may not be reproduced
            without prior written consent.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            Rush N Relax is not liable for any indirect, incidental, or
            consequential damages arising from the use or inability to use our
            products or website. Our liability is limited to the purchase price
            of the product in question.
          </p>

          <h2>7. Governing Law</h2>
          <p>
            These terms are governed by the laws of the State of Tennessee,
            without regard to conflict of law provisions. Any disputes shall be
            resolved in the courts of Anderson County, Tennessee.
          </p>

          <h2>8. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of the site
            after changes constitutes acceptance of the revised Terms.
          </p>

          <h2>9. Contact</h2>
          <p>
            Questions about these Terms? Contact us at{' '}
            <a href="/contact">our contact page</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
