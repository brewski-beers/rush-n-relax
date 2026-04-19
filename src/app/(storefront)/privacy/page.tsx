import { buildMetadata } from '@/lib/seo/metadata.factory';

export const metadata = buildMetadata('/privacy', {
  title: 'Privacy Policy — Rush N Relax',
  description:
    'How Rush N Relax collects, uses, and protects your personal information.',
  path: '/privacy',
  noindex: true,
});

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero asymmetry-section-stable page-hero-shell">
        <div className="container">
          <h1>Privacy Policy</h1>
          <p className="lead">Last updated: April 16, 2026</p>
        </div>
      </section>

      <section className="legal-content asymmetry-section-stable">
        <div className="container">
          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly — such as your name,
            email address, shipping address, and payment information when you
            make a purchase or contact us. We also collect limited technical
            data (IP address, browser type, pages visited) through standard web
            analytics tools.
          </p>

          <h2>2. How We Use Your Information</h2>
          <p>
            We use your information to fulfill orders, respond to inquiries,
            send transactional emails (receipts, shipping updates), and improve
            our website. We do not sell, rent, or share your personal
            information with third parties for marketing purposes.
          </p>

          <h2>3. Age Verification</h2>
          <p>
            We collect age verification data solely to confirm that visitors
            meet the minimum age requirement of 21 years. This data is stored
            only in your browser session and is not transmitted to our servers.
          </p>

          <h2>4. Cookies</h2>
          <p>
            We use session cookies for age verification and cart functionality.
            We may use analytics cookies (e.g., Google Analytics) to understand
            how visitors use our site. You may disable cookies in your browser
            settings; however, some site features may not function correctly.
          </p>

          <h2>5. Payment Security</h2>
          <p>
            Payment processing is handled by PCI-compliant third-party
            processors. Rush N Relax does not store full credit card numbers on
            our servers.
          </p>

          <h2>6. Data Retention</h2>
          <p>
            We retain order and contact records for up to 5 years for accounting
            and legal compliance purposes. You may request deletion of your
            personal data by contacting us directly, subject to applicable legal
            retention requirements.
          </p>

          <h2>7. Your Rights</h2>
          <p>
            You have the right to access, correct, or request deletion of your
            personal information. To exercise these rights, contact us through
            our <a href="/contact">contact page</a>.
          </p>

          <h2>8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. We will post the
            revised policy on this page with an updated date. Continued use of
            the site constitutes acceptance.
          </p>
        </div>
      </section>
    </main>
  );
}
