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
          <p className="lead">Coming soon</p>
        </div>
      </section>

      <section className="legal-content asymmetry-section-stable">
        <div className="container">
          <p>
            Our Shipping &amp; Returns policy is being finalized. In the
            meantime, please reach out through our{' '}
            <a href="/contact">contact page</a> with any questions about an
            order.
          </p>
        </div>
      </section>
    </main>
  );
}
