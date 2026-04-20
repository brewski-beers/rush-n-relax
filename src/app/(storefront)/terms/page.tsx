import { buildMetadata } from '@/lib/seo/metadata.factory';

export const metadata = buildMetadata('/terms', {
  title: 'Terms & Conditions — Rush N Relax',
  description:
    'Terms and conditions governing your use of the Rush N Relax website and purchase of hemp and CBD products.',
  path: '/terms',
  noindex: true,
});

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero asymmetry-section-stable page-hero-shell">
        <div className="container">
          <h1>Terms &amp; Conditions</h1>
          <p className="lead">Coming soon</p>
        </div>
      </section>

      <section className="legal-content asymmetry-section-stable">
        <div className="container">
          <p>
            Our Terms &amp; Conditions are being finalized. In the meantime,
            please reach out through our <a href="/contact">contact page</a>{' '}
            with any questions.
          </p>
        </div>
      </section>
    </main>
  );
}
