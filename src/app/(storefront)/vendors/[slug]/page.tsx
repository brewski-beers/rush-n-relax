import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { CardGrid } from '@/components/CardGrid';
import { ProductImage } from '@/components/ProductImage';
import { buildMetadata } from '@/lib/seo/metadata.factory';
import {
  getOnlineInStockSet,
  getVendorBySlug,
  listProductsByVendor,
} from '@/lib/repositories';
import { seoConfig } from '@/config/seo.config';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);
  if (!vendor) return {};

  return buildMetadata('/vendors/[slug]', {
    title: `${vendor.name} Products | Rush N Relax`,
    description:
      vendor.description ??
      `Browse ${vendor.name} products available at Rush N Relax dispensaries in East Tennessee.`,
    canonical: `${seoConfig.site.domain}/vendors/${slug}`,
    path: `/vendors/${slug}`,
  });
}

export default async function VendorDetailPage({ params }: Props) {
  const { slug } = await params;
  const [vendor, productsPage] = await Promise.all([
    getVendorBySlug(slug),
    listProductsByVendor(slug),
  ]);

  // Gate vendor listing to products that are in stock online — the vendor page
  // is a storefront surface, same expectation as /products.
  const onlineIds = await getOnlineInStockSet(
    productsPage.items.map(p => p.id)
  );
  const products = productsPage.items.filter(p => onlineIds.has(p.id));

  if (!vendor || !vendor.isActive) notFound();

  return (
    <main className="vendor-detail-page">
      <section className="vendor-detail-hero asymmetry-section-stable page-hero-shell">
        <div className="container">
          <nav className="vendor-breadcrumb" aria-label="Breadcrumb">
            <Link href="/vendors">Our Vendors</Link>
            <span aria-hidden="true"> / </span>
            <span>{vendor.name}</span>
          </nav>

          <h1>{vendor.name}</h1>

          {vendor.categories.length > 0 && (
            <div className="vendor-detail-categories">
              {vendor.categories.map((cat: string) => (
                <span key={cat} className="vendor-category-tag">
                  {cat}
                </span>
              ))}
            </div>
          )}

          {vendor.description && <p className="lead">{vendor.description}</p>}

          {vendor.website && (
            <a
              href={vendor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn vendor-website-btn"
            >
              Visit {vendor.name}&apos;s Website →
            </a>
          )}
        </div>
      </section>

      <section className="vendor-products asymmetry-section-anchor">
        <div className="container">
          <h2>Products by {vendor.name}</h2>

          {products.length === 0 ? (
            <p className="text-secondary vendor-empty-state">
              No products from {vendor.name} are currently available. Check back
              soon.
            </p>
          ) : (
            <CardGrid columns="auto" gap="lg">
              {products.map(
                (product: import('@/types').ProductSummary, index: number) => (
                  <Card
                    key={product.id}
                    variant="product"
                    to={`/products/${product.slug}`}
                    surface={index % 3 === 1 ? 'anchor' : 'stable'}
                    elevation={index % 3 === 1 ? 'soft' : 'none'}
                    motion={index % 3 === 1}
                  >
                    <ProductImage
                      slug={product.slug}
                      alt={product.name}
                      path={product.image}
                    />
                    <div className="product-card-content">
                      <div className="product-category">{product.category}</div>
                      <h3>{product.name}</h3>
                      <div className="product-card-cta">View Details →</div>
                    </div>
                  </Card>
                )
              )}
            </CardGrid>
          )}
        </div>
      </section>
    </main>
  );
}
