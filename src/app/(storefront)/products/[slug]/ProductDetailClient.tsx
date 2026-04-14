'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProductImage } from '@/components/ProductImage';
import { LOCATIONS } from '@/constants/locations';
import {
  getVariantsForCategory,
  getSizeLabelForCategory,
} from '@/constants/product-variants';
import type { Product, ProductSummary, ProductStrain } from '@/types';

const STRAIN_LABELS: Record<ProductStrain, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

function StrainBadge({ strain }: { strain: ProductStrain }) {
  return (
    <span className={`product-strain-badge product-strain-badge--${strain}`}>
      {STRAIN_LABELS[strain]}
    </span>
  );
}

function TagGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="product-hero-tag-group">
      <span className="product-hero-tag-label">{label}</span>
      <div className="product-hero-pills">{children}</div>
    </div>
  );
}

export default function ProductDetailClient({
  product,
  relatedProducts,
  coaSignedUrl,
}: {
  product: Product;
  relatedProducts: ProductSummary[];
  coaSignedUrl?: string;
}) {
  const variants = getVariantsForCategory(product.category);
  const sizeLabel = getSizeLabelForCategory(product.category);

  const galleryImages =
    product.images && product.images.length > 0 ? product.images : [];
  const [activeImage, setActiveImage] = useState<string | undefined>(
    galleryImages[0] ?? product.image
  );
  const [selectedVariant, setSelectedVariant] = useState<string>(
    variants[0]?.key ?? ''
  );

  const locationNames = product.availableAt
    .map(slug => LOCATIONS.find(loc => loc.slug === slug)?.name)
    .filter((n): n is string => Boolean(n));

  const effects = Array.isArray(product.effects)
    ? product.effects.filter((e): e is string => Boolean(e))
    : [];

  const flavors = Array.isArray(product.flavors)
    ? product.flavors.filter((f): f is string => Boolean(f))
    : [];

  const terpenes = Array.isArray(product.labResults?.terpenes)
    ? product.labResults.terpenes.filter((t): t is string => Boolean(t))
    : [];

  const hasLabData =
    product.labResults?.thcPercent !== undefined ||
    product.labResults?.cbdPercent !== undefined ||
    product.labResults?.testDate !== undefined ||
    product.labResults?.labName !== undefined;

  const showEffectsGroup =
    product.labResults?.thcPercent !== undefined || effects.length > 0;

  return (
    <main className="product-detail-page">
      <section className="back-to-products">
        <div className="container">
          <Link href="/products" className="link-button">
            ← Back to All Products
          </Link>
        </div>
      </section>

      {/* ── Hero — 2-column ─────────────────────────────────────────────── */}
      <section className="product-hero-section asymmetry-section-stable">
        <div className="container product-hero-grid">
          {/* Left: thumbnail strip + main image */}
          <div className="product-hero-media">
            {galleryImages.length > 1 && (
              <div className="product-thumbnail-strip">
                {galleryImages.map((path, i) => (
                  <button
                    key={path}
                    type="button"
                    className={`product-thumbnail-btn${activeImage === path ? ' product-thumbnail-btn--active' : ''}`}
                    onClick={() => setActiveImage(path)}
                    aria-label={`View image ${i + 1}`}
                  >
                    <ProductImage
                      slug={product.slug}
                      path={path}
                      alt={`${product.name} ${i + 1}`}
                      className="product-thumbnail-img"
                    />
                  </button>
                ))}
              </div>
            )}
            <div className="product-main-image-wrap">
              <ProductImage
                slug={product.slug}
                path={activeImage ?? product.image}
                alt={product.name}
                className="product-main-img"
              />
            </div>
          </div>

          {/* Right: product info */}
          <div className="product-hero-info">
            <h1 className="product-hero-name">{product.name}</h1>

            {/* Strain */}
            {product.strain && (
              <TagGroup label="Strain">
                <StrainBadge strain={product.strain} />
              </TagGroup>
            )}

            {/* THC + Effects */}
            {showEffectsGroup && (
              <TagGroup label="Effects">
                {product.labResults?.thcPercent !== undefined && (
                  <span className="product-pill product-pill--thc">
                    THC {product.labResults.thcPercent}%
                  </span>
                )}
                {effects.map(effect => (
                  <span
                    key={effect}
                    className="product-pill product-pill--gold"
                  >
                    {effect}
                  </span>
                ))}
              </TagGroup>
            )}

            {/* Flavors */}
            {flavors.length > 0 && (
              <TagGroup label="Flavors">
                {flavors.map(flavor => (
                  <span key={flavor} className="product-flavor-tag">
                    {flavor}
                  </span>
                ))}
              </TagGroup>
            )}

            <p className="product-try-in-store-nudge">
              <Link href="/locations" className="product-try-in-store-link">
                Try in store — find a location near you →
              </Link>
            </p>

            {/* ── Pricing variants ─────────────────────────────────────── */}
            <div className="product-pricing-block">
              <span className="product-hero-tag-label">{sizeLabel}</span>
              <div className="product-variant-grid">
                {variants.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    className={`product-variant-card${selectedVariant === v.key ? ' product-variant-card--active' : ''}`}
                    onClick={() => setSelectedVariant(v.key)}
                    aria-pressed={selectedVariant === v.key}
                  >
                    <span className="product-variant-card-size">{v.label}</span>
                    <span className="product-variant-card-price">—</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Info table — Terpenes + cannabinoid detail */}
            {(terpenes.length > 0 || hasLabData) && (
              <table className="product-info-table">
                <tbody>
                  {product.labResults?.thcPercent !== undefined && (
                    <tr>
                      <th>THC</th>
                      <td>{product.labResults.thcPercent}%</td>
                    </tr>
                  )}
                  {product.labResults?.cbdPercent !== undefined && (
                    <tr>
                      <th>CBD</th>
                      <td>{product.labResults.cbdPercent}%</td>
                    </tr>
                  )}
                  {terpenes.length > 0 && (
                    <tr>
                      <th>Terpenes</th>
                      <td>{terpenes.join(', ')}</td>
                    </tr>
                  )}
                  {product.labResults?.labName && (
                    <tr>
                      <th>Lab</th>
                      <td>{product.labResults.labName}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {locationNames.length > 0 && (
              <div className="product-available-at">
                <span className="product-available-at-label">
                  Available at:
                </span>{' '}
                {locationNames.join(', ')}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Details — flat section ───────────────────────────────────────── */}
      {product.details && (
        <section className="product-details-section asymmetry-section-stable">
          <div className="container">
            <p className="product-details-body">{product.details}</p>
          </div>
        </section>
      )}

      {/* ── COA link ─────────────────────────────────────────────────────── */}
      {coaSignedUrl && (
        <section className="product-coa-section asymmetry-section-stable">
          <div className="container">
            <a
              href={coaSignedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              View Certificate of Analysis
            </a>
          </div>
        </section>
      )}

      {/* ── Related products — horizontal scroll strip ───────────────────── */}
      {relatedProducts.length > 0 && (
        <section className="related-products asymmetry-section-anchor">
          <div className="container">
            <h2 className="asymmetry-headline-anchor">Explore More</h2>
            <div className="related-strip">
              {relatedProducts.map(related => (
                <Link
                  key={related.id}
                  href={`/products/${related.slug}`}
                  className="related-strip-card"
                >
                  <div className="related-strip-img-wrap">
                    {related.strain && (
                      <span
                        className={`product-strain-badge product-strain-badge--${related.strain} related-strip-strain-badge`}
                      >
                        {STRAIN_LABELS[related.strain]}
                      </span>
                    )}
                    <ProductImage
                      slug={related.slug}
                      path={related.image}
                      alt={related.name}
                      className="related-strip-img"
                    />
                  </div>
                  <div className="related-strip-info">
                    <div className="product-category-badge">
                      {related.category.toUpperCase()}
                    </div>
                    <h3 className="related-strip-name">{related.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="product-cta asymmetry-section-stable">
        <div className="container">
          <h2>Visit Us to Experience This Product</h2>
          <p>
            Find our locations and explore the full RnR collection in person.
          </p>
          <Link
            href="/locations"
            className="btn btn-primary asymmetry-motion-anchor"
          >
            Find a Location
          </Link>
        </div>
      </section>
    </main>
  );
}
