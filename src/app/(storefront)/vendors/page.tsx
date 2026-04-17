import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata.factory';
import { listVendors } from '@/lib/repositories';

export const revalidate = 3600;

export const metadata = buildMetadata('/vendors', {
  title: 'Our Vendors | Rush N Relax',
  description:
    'Meet the brands behind our shelves. Every vendor is hand-selected for quality, transparency, and lab-tested products at Rush N Relax dispensaries in East Tennessee.',
  path: '/vendors',
});

export default async function VendorsPage() {
  const vendors = await listVendors();

  return (
    <main className="vendors-page">
      <section className="vendors-hero asymmetry-section-stable page-hero-shell">
        <div className="container">
          <h1>Our Vendors</h1>
          <p className="lead">
            We source from brands we trust — lab-tested, vetted, and worthy of a
            spot on our shelves.
          </p>
        </div>
      </section>

      <section className="vendors-directory asymmetry-section-anchor">
        <div className="container">
          {vendors.length === 0 ? (
            <p className="text-secondary">
              No vendors listed yet — check back soon.
            </p>
          ) : (
            <div className="vendors-grid">
              {vendors.map(
                (vendor: import('@/types').VendorSummary, index: number) => (
                  <Link
                    key={vendor.slug}
                    href={`/vendors/${vendor.slug}`}
                    className={[
                      'rnr-card',
                      'rnr-card--product',
                      index % 3 === 1
                        ? 'rnr-card--surface-anchor rnr-card--anchor rnr-card--elevation-soft rnr-card--motion'
                        : 'rnr-card--surface-stable rnr-card--stable rnr-card--elevation-none',
                      'vendor-card',
                    ].join(' ')}
                  >
                    <div className="vendor-card-content">
                      <h2 className="vendor-card-name">{vendor.name}</h2>
                      {vendor.categories.length > 0 && (
                        <div className="vendor-card-categories">
                          {vendor.categories.map((cat: string) => (
                            <span key={cat} className="vendor-category-tag">
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="vendor-card-cta">View Products →</div>
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
