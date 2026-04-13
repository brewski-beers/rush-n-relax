'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProductImage } from '@/components/ProductImage';
import { LOCATIONS } from '@/constants/locations';
import type { Product, ProductSummary, ProductStrain } from '@/types';

// ── Strain badge ─────────────────────────────────────────────────────────────

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

// ── Effect score bar ──────────────────────────────────────────────────────────

function EffectBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="effect-bar">
      <div className="effect-bar-label">{label}</div>
      <progress
        className="effect-bar-progress"
        value={score}
        max={100}
        aria-label={label}
      />
      <div className="effect-bar-pct">{score}%</div>
    </div>
  );
}

// ── Accordion section ─────────────────────────────────────────────────────────

function Accordion({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <details className="product-accordion">
      <summary className="product-accordion-summary">
        <span className="product-accordion-icon" aria-hidden="true">
          {icon}
        </span>
        {title}
        <span className="product-accordion-chevron" aria-hidden="true">
          ›
        </span>
      </summary>
      <div className="product-accordion-body">{children}</div>
    </details>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductDetailClient({
  product,
  relatedProducts,
}: {
  product: Product;
  relatedProducts: ProductSummary[];
}) {
  // Gallery state — first image in product.images is active by default
  const galleryImages =
    product.images && product.images.length > 0 ? product.images : [];
  const [activeImage, setActiveImage] = useState<string | undefined>(
    galleryImages[0] ?? product.image
  );

  // Map availableAt slugs → location display names
  const locationNames = product.availableAt
    .map(slug => LOCATIONS.find(loc => loc.slug === slug)?.name)
    .filter((n): n is string => n !== undefined);

  const hasEffectScores =
    product.effectScores !== undefined &&
    Object.values(product.effectScores).some(v => v !== undefined);

  const hasWhatToExpect =
    product.whatToExpect !== undefined && product.whatToExpect.length > 0;

  return (
    <main className="product-detail-page">
      {/* Back navigation */}
      <section className="back-to-products">
        <div className="container">
          <Link href="/products" className="link-button">
            ← Back to All Products
          </Link>
        </div>
      </section>

      {/* ── Hero — 2-column ────────────────────────────────────────────── */}
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
                      alt={`${product.name} thumbnail ${i + 1}`}
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

            {product.strain && (
              <div className="product-hero-badges">
                <StrainBadge strain={product.strain} />
              </div>
            )}

            {(product.labResults?.thcPercent !== undefined ||
              (product.effects && product.effects.length > 0)) && (
              <div className="product-hero-pills">
                {product.labResults?.thcPercent !== undefined && (
                  <span className="product-pill product-pill--thc">
                    THC {product.labResults.thcPercent}%
                  </span>
                )}
                {product.effects?.map(effect => (
                  <span
                    key={effect}
                    className="product-pill product-pill--effect"
                  >
                    {effect}
                  </span>
                ))}
              </div>
            )}

            <p className="product-hero-description">{product.description}</p>

            {/* Info grid */}
            <table className="product-info-table">
              <tbody>
                {product.strain && (
                  <tr>
                    <th>Strain</th>
                    <td>{STRAIN_LABELS[product.strain]}</td>
                  </tr>
                )}
                {product.labResults?.thcPercent !== undefined && (
                  <tr>
                    <th>THC</th>
                    <td>{product.labResults.thcPercent}%</td>
                  </tr>
                )}
                {product.labResults?.terpenes &&
                  product.labResults.terpenes.length > 0 && (
                    <tr>
                      <th>Terpenes</th>
                      <td>{product.labResults.terpenes.join(', ')}</td>
                    </tr>
                  )}
                {product.effects && product.effects.length > 0 && (
                  <tr>
                    <th>Effects</th>
                    <td>{product.effects.join(', ')}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {locationNames.length > 0 && (
              <div className="product-available-at">
                <span className="product-available-at-label">
                  Available at:
                </span>{' '}
                {locationNames.join(', ')}
              </div>
            )}

            <Link href="/locations" className="btn btn-primary product-cta-btn">
              Find a Location →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Below fold — accordions ────────────────────────────────────── */}
      <section className="product-accordions-section asymmetry-section-stable">
        <div className="container">
          {product.details && (
            <Accordion title="Description" icon="📋">
              <p>{product.details}</p>
            </Accordion>
          )}

          {(hasWhatToExpect || hasEffectScores) && (
            <Accordion title="What It Feels Like" icon="✨">
              {hasWhatToExpect && (
                <ul className="product-what-to-expect">
                  {product.whatToExpect!.map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ul>
              )}
              {hasEffectScores && (
                <div className="effect-bars">
                  {product.effectScores!.relaxation !== undefined && (
                    <EffectBar
                      label="Relaxation"
                      score={product.effectScores!.relaxation}
                    />
                  )}
                  {product.effectScores!.energy !== undefined && (
                    <EffectBar
                      label="Energy"
                      score={product.effectScores!.energy}
                    />
                  )}
                  {product.effectScores!.creativity !== undefined && (
                    <EffectBar
                      label="Creativity"
                      score={product.effectScores!.creativity}
                    />
                  )}
                  {product.effectScores!.euphoria !== undefined && (
                    <EffectBar
                      label="Euphoria"
                      score={product.effectScores!.euphoria}
                    />
                  )}
                  {product.effectScores!.focus !== undefined && (
                    <EffectBar
                      label="Focus"
                      score={product.effectScores!.focus}
                    />
                  )}
                  {product.effectScores!.painRelief !== undefined && (
                    <EffectBar
                      label="Pain Relief"
                      score={product.effectScores!.painRelief}
                    />
                  )}
                </div>
              )}
            </Accordion>
          )}

          {product.labResults?.terpenes &&
            product.labResults.terpenes.length > 0 && (
              <Accordion title="Terpene Profile" icon="🌿">
                <div className="product-tags">
                  {product.labResults.terpenes.map(t => (
                    <span key={t} className="product-tag">
                      {t}
                    </span>
                  ))}
                </div>
              </Accordion>
            )}

          {(product.labResults?.thcPercent !== undefined ||
            product.labResults?.cbdPercent !== undefined ||
            product.labResults?.testDate !== undefined ||
            product.labResults?.labName !== undefined) && (
            <Accordion title="Cannabinoid Information" icon="🧬">
              <table className="product-info-table">
                <tbody>
                  {product.labResults.thcPercent !== undefined && (
                    <tr>
                      <th>THC</th>
                      <td>{product.labResults.thcPercent}%</td>
                    </tr>
                  )}
                  {product.labResults.cbdPercent !== undefined && (
                    <tr>
                      <th>CBD</th>
                      <td>{product.labResults.cbdPercent}%</td>
                    </tr>
                  )}
                  {product.labResults.testDate && (
                    <tr>
                      <th>Test Date</th>
                      <td>{product.labResults.testDate}</td>
                    </tr>
                  )}
                  {product.labResults.labName && (
                    <tr>
                      <th>Lab</th>
                      <td>{product.labResults.labName}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Accordion>
          )}

          {product.flavors && product.flavors.length > 0 && (
            <Accordion title="Flavor Profile" icon="🍋">
              <div className="product-tags">
                {product.flavors.map(f => (
                  <span key={f} className="product-tag">
                    {f}
                  </span>
                ))}
              </div>
            </Accordion>
          )}

          {product.coaUrl && (
            <Accordion title="Lab Results / COA" icon="📄">
              <a
                href={product.coaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                View Certificate of Analysis
              </a>
            </Accordion>
          )}
        </div>
      </section>

      {/* ── Related products — horizontal scroll strip ────────────────── */}
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

      {/* CTA */}
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
