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
          <p className="lead">Coming soon</p>
        </div>
      </section>

      <section className="legal-content asymmetry-section-stable">
        <div className="container">
          <p>
            Our Privacy Policy is being finalized. In the meantime, please reach
            out through our <a href="/contact">contact page</a> with any
            questions about how we handle your information.
          </p>
        </div>
      </section>
    </main>
  );
}
