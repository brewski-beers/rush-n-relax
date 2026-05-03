'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProductImage } from '@/components/ProductImage';
import { getStorageUrl } from '@/lib/storage/url-cache';
import { AddToCartButton } from '@/components/AddToCartButton';
import { LOCATIONS } from '@/constants/locations';
import type { Product, ProductSummary, ProductStrain } from '@/types';
import type { InventoryItem } from '@/types/inventory';
import {
  resolveVariantPricing,
  type DisplayVariant,
} from '@/lib/storefront/resolveVariantPricing';
import { NutritionFactsPanel } from '@/components/NutritionFactsPanel';

/**
 * Resolves an image value to a renderable URL.
 *
 * Accepts either a Firebase Storage path (e.g. "products/foo.webp") which
 * gets converted via getStorageUrl, OR a pre-resolved absolute URL (when the
 * server already constructed the public URL — see heroImageUrl). Without this
 * guard, passing an absolute URL through getStorageUrl percent-encodes the
 * scheme/host into the storage path, producing a broken URL and a placeholder
 * fallback. Regression source: PR #341 thumbnail strip.
 */
function resolveImageSrc(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  return value.startsWith('http') ? value : getStorageUrl(value);
}

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
  heroImageUrl,
  variantPricing,
  itemInStock = false,
}: {
  product: Product;
  relatedProducts: ProductSummary[];
  coaSignedUrl?: string;
  /**
   * Server-resolved public Firebase Storage URL for the hero image.
   * When provided, the hero <img> is rendered directly (no client-side
   * getDownloadURL call) so the browser can see the src at SSR time and
   * preload it — fixing the LCP regression.
   */
  heroImageUrl?: string;
  /** variantPricing from inventory/online/items/{slug} — drives variant selector */
  variantPricing?: InventoryItem['variantPricing'];
  /** Item-level inStock from inventory/online — fallback when variant-level flag absent */
  itemInStock?: boolean;
}) {
  // Resolve display variants from product definition + online inventory pricing
  const displayVariants: DisplayVariant[] = resolveVariantPricing(
    product.variants,
    variantPricing,
    itemInStock
  );
  const hasOnlinePricing = displayVariants.length > 0;

  // Featured image is always first; gallery images follow in order.
  // heroImageUrl is a pre-resolved public URL (server-side) for faster LCP.
  const featuredUrl = heroImageUrl ?? product.image;
  const allImages: string[] = [
    ...(featuredUrl ? [featuredUrl] : []),
    ...(product.images ?? []),
  ];
  const [activeImage, setActiveImage] = useState<string | undefined>(
    allImages[0]
  );

  const variantGroups = product.variantGroups ?? [];

  // Single active variant selection across all groups.
  // Standalone groups: optionId === variantId directly.
  // Combinable groups: combined optionIds joined with '-' form the variantId.
  const [activeVariantId, setActiveVariantId] = useState<string>(
    displayVariants[0]?.variantId ?? ''
  );

  // Per-group selection state — used for combinable cross-product resolution.
  const [groupSelections, setGroupSelections] = useState<
    Record<string, string>
  >({});

  // Build a displayVariants lookup map for O(1) price access by variantId.
  const pricingMap = new Map(displayVariants.map(v => [v.variantId, v]));

  // Resolve combined variantId from combinable group selections.
  const combinableGroups = variantGroups.filter(g => g.combinable);
  const combinedId =
    combinableGroups.length > 0
      ? combinableGroups
          .map(g => groupSelections[g.groupId])
          .filter(Boolean)
          .join('-')
      : '';

  const selectedVariantId = activeVariantId;
  const selectedVariant: DisplayVariant | undefined =
    pricingMap.get(selectedVariantId);

  function selectOption(
    groupId: string,
    optionId: string,
    combinable: boolean
  ) {
    if (combinable) {
      const next = { ...groupSelections, [groupId]: optionId };
      setGroupSelections(next);
      // Resolve combined variantId once all combinable groups are selected
      const allSelected = combinableGroups.every(g => next[g.groupId]);
      if (allSelected) {
        setActiveVariantId(
          combinableGroups.map(g => next[g.groupId]).join('-')
        );
      }
    } else {
      setActiveVariantId(optionId);
    }
  }

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

  // When the user clicks a thumbnail, we may need to show the server-resolved
  // hero URL (for the primary image) or fall back to ProductImage (for gallery
  // images whose URLs were not pre-resolved).
  const isActiveImagePrimary = activeImage === featuredUrl;

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
            {allImages.length > 1 && (
              <div className="product-thumbnail-strip">
                {allImages.map((path, i) => (
                  <button
                    key={path}
                    type="button"
                    className={`product-thumbnail-btn${activeImage === path ? ' product-thumbnail-btn--active' : ''}`}
                    onClick={() => setActiveImage(path)}
                    aria-label={`View image ${i + 1}`}
                  >
                    <ProductImage
                      src={resolveImageSrc(path)}
                      alt={`${product.name} ${i + 1}`}
                      className="product-thumbnail-img"
                    />
                  </button>
                ))}
              </div>
            )}
            <div className="product-main-image-wrap">
              {/* Render the hero image directly when the server-resolved URL is
                  available and the primary image is active — this lets the browser
                  see the src at SSR time and start loading immediately (LCP fix).
                  For gallery images (non-primary), fall back to ProductImage. */}
              {heroImageUrl && isActiveImagePrimary ? (
                <div className="product-card-img product-main-img">
                  <img
                    src={heroImageUrl}
                    alt={product.name}
                    className="product-image product-image-loaded"
                    fetchPriority="high"
                    loading="eager"
                    decoding="async"
                  />
                </div>
              ) : (
                <ProductImage
                  src={resolveImageSrc(activeImage ?? product.image)}
                  alt={product.name}
                  className="product-main-img"
                />
              )}
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

            {/* ── Variant selector ────────────────────────────────────────────── */}
            {hasOnlinePricing ? (
              variantGroups.length > 0 ? (
                /* Group-aware selector — all groups visible simultaneously.
                   Standalone groups: each option is a direct SKU with its own price.
                   Combinable groups: options are chips; price shown after all are selected. */
                <div className="product-pricing-block">
                  {variantGroups.map(group => (
                    <div
                      key={group.groupId}
                      className="product-variant-group-block"
                    >
                      <span className="product-hero-tag-label">
                        {group.label}
                      </span>
                      <div className="product-variant-grid">
                        {group.options.map(opt => {
                          const variantId = group.combinable
                            ? combinedId
                            : opt.optionId;
                          const pricing = group.combinable
                            ? undefined
                            : pricingMap.get(opt.optionId);
                          const isActive = group.combinable
                            ? groupSelections[group.groupId] === opt.optionId
                            : activeVariantId === opt.optionId;
                          const oos = pricing ? !pricing.inStock : false;
                          return (
                            <button
                              key={opt.optionId}
                              type="button"
                              className={[
                                'product-variant-card',
                                isActive ? 'product-variant-card--active' : '',
                                oos ? 'product-variant-card--oos' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onClick={() =>
                                selectOption(
                                  group.groupId,
                                  opt.optionId,
                                  group.combinable
                                )
                              }
                              aria-pressed={isActive}
                              disabled={oos}
                            >
                              <span className="product-variant-card-size">
                                {opt.label}
                              </span>
                              {pricing && (
                                <span className="product-variant-card-price">
                                  {pricing.inStock ? (
                                    <>
                                      ${(pricing.price / 100).toFixed(2)}
                                      {pricing.compareAtPrice !== undefined && (
                                        <span className="product-variant-card-compare-at">
                                          $
                                          {(
                                            pricing.compareAtPrice / 100
                                          ).toFixed(2)}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    'Out of stock'
                                  )}
                                </span>
                              )}
                            </button>
                          );
                          void variantId; // variantId used via selectOption/activeVariantId
                        })}
                      </div>
                    </div>
                  ))}
                  {/* Combined price — shown when all combinable groups have a selection */}
                  {combinableGroups.length > 0 && selectedVariant && (
                    <div className="product-variant-price-summary">
                      <span className="product-variant-card-price">
                        {selectedVariant.inStock ? (
                          <>
                            ${(selectedVariant.price / 100).toFixed(2)}
                            {selectedVariant.compareAtPrice !== undefined && (
                              <span className="product-variant-card-compare-at">
                                $
                                {(selectedVariant.compareAtPrice / 100).toFixed(
                                  2
                                )}
                              </span>
                            )}
                          </>
                        ) : (
                          'Out of stock'
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Legacy flat selector — products without variantGroups */
                <div className="product-pricing-block">
                  <div className="product-variant-grid">
                    {displayVariants.map(v => (
                      <button
                        key={v.variantId}
                        type="button"
                        className={[
                          'product-variant-card',
                          activeVariantId === v.variantId
                            ? 'product-variant-card--active'
                            : '',
                          !v.inStock ? 'product-variant-card--oos' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => setActiveVariantId(v.variantId)}
                        aria-pressed={activeVariantId === v.variantId}
                        disabled={!v.inStock}
                      >
                        <span className="product-variant-card-size">
                          {v.label}
                        </span>
                        <span className="product-variant-card-price">
                          {v.inStock ? (
                            <>
                              ${(v.price / 100).toFixed(2)}
                              {v.compareAtPrice !== undefined && (
                                <span className="product-variant-card-compare-at">
                                  ${(v.compareAtPrice / 100).toFixed(2)}
                                </span>
                              )}
                            </>
                          ) : (
                            'Out of stock'
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : (
              product.variants &&
              product.variants.length > 0 && (
                <div className="product-pricing-block">
                  {variantGroups.length > 0 ? (
                    /* Group-aware "see in store" — same segmentation as the online path */
                    variantGroups.map(group => (
                      <div
                        key={group.groupId}
                        className="product-variant-group-block"
                      >
                        <span className="product-hero-tag-label">
                          {group.label}
                        </span>
                        <div className="product-variant-grid">
                          {group.options.map(opt => (
                            <div
                              key={opt.optionId}
                              className="product-variant-card product-variant-card--static"
                            >
                              <span className="product-variant-card-size">
                                {opt.label}
                              </span>
                              <span className="product-variant-card-price">
                                See in store
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    /* Legacy flat fallback — products without variantGroups */
                    <>
                      <span className="product-hero-tag-label">Sizes</span>
                      <div className="product-variant-grid">
                        {product.variants.map(v => (
                          <div
                            key={v.variantId}
                            className="product-variant-card product-variant-card--static"
                          >
                            <span className="product-variant-card-size">
                              {v.label}
                            </span>
                            <span className="product-variant-card-price">
                              See in store
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            )}

            {/* Primary CTA — above the fold */}
            {hasOnlinePricing ? (
              <AddToCartButton
                productId={product.id}
                productName={product.name}
                productImage={heroImageUrl ?? product.image}
                selectedVariant={selectedVariant}
                showQtySelector
              />
            ) : (
              <Link href="/locations" className="btn btn-primary">
                Find a Location Near You
              </Link>
            )}

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
            <h2 className="product-section-heading">Description</h2>
            <p className="product-details-body">{product.details}</p>
          </div>
        </section>
      )}

      {/* Nutrition Facts -- edibles only */}
      {product.category === 'edibles' && product.nutritionFacts != null && (
        <section className="product-nutrition-section asymmetry-section-stable">
          <div className="container">
            <h2 className="product-section-heading">Nutrition Information</h2>
            {/* non-null safe: product.nutritionFacts != null checked above */}
            <NutritionFactsPanel facts={product.nutritionFacts} />
          </div>
        </section>
      )}

      {/* ── COA link ─────────────────────────────────────────────────────── */}
      {coaSignedUrl && (
        <section className="product-coa-section asymmetry-section-stable">
          <div className="container">
            <p className="product-coa-context">
              Third-party lab tested — view the full certificate of analysis
            </p>
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
                      src={resolveImageSrc(related.image)}
                      alt={related.name}
                      className="related-strip-img"
                    />
                  </div>
                  <div className="related-strip-info">
                    <div className="product-category-badge">
                      {related.category}
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
            className="btn btn-secondary asymmetry-motion-anchor"
          >
            Find a Location
          </Link>
        </div>
      </section>
    </main>
  );
}
