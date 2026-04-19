import { notFound } from 'next/navigation';
import {
  getProductBySlug,
  listOnlineAvailableInventory,
  listProductsByIds,
  getInventoryItem,
} from '@/lib/repositories';
import { ONLINE_LOCATION_ID } from '@/lib/firebase/admin';
import { getAdminStorage } from '@/lib/firebase/admin';
import { buildMetadata } from '@/lib/seo/metadata.factory';
import { buildProductSchema } from '@/lib/seo/schemas/product';
import { buildBreadcrumbSchema } from '@/lib/seo/schemas/breadcrumb';
import { JsonLd } from '@/components/JsonLd';
import { seoConfig } from '@/config/seo.config';
import '@/styles/products.css';
import ProductDetailClient from './ProductDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 3600;

const STORAGE_BUCKET = 'rush-n-relax.firebasestorage.app';

/**
 * Build a public (no-auth) Firebase Storage download URL from a storage path.
 * This avoids a client-side getDownloadURL round-trip for the hero image,
 * which was causing a 1–3s LCP penalty.
 */
function buildPublicStorageUrl(storagePath: string): string {
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media`;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  return buildMetadata('/products/[slug]', {
    title: `${product.name} — Premium Cannabis | Rush N Relax`,
    description: product.details ?? '',
    canonical: `${seoConfig.site.domain}/products/${slug}`,
    path: `/products/${slug}`,
  });
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const [product, onlineInventory, onlineItem] = await Promise.all([
    getProductBySlug(slug),
    listOnlineAvailableInventory(),
    getInventoryItem(ONLINE_LOCATION_ID, slug),
  ]);
  if (!product || product.status === 'archived') notFound();

  const onlineSlugs = onlineInventory
    .map(i => i.productId)
    .filter(id => id !== slug);
  const relatedProducts = (await listProductsByIds(onlineSlugs)).slice(0, 6);

  // Resolve hero image URL server-side to avoid client-side Firebase Storage
  // getDownloadURL round-trip, which blocks LCP by 1–3s.
  const heroImageUrl = product.image
    ? buildPublicStorageUrl(product.image)
    : undefined;

  // Generate a fresh signed URL for the COA PDF if one is stored.
  // Page revalidates every hour so the 1-hour signed URL stays valid.
  let coaSignedUrl: string | undefined;
  if (product.coaUrl) {
    try {
      const coaPath = product.coaUrl.startsWith('COA/')
        ? product.coaUrl
        : undefined;

      if (coaPath) {
        // eslint-disable-next-line react-hooks/purity -- server component, not a hook
        const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1_000);
        const [url] = await getAdminStorage()
          .bucket()
          .file(coaPath)
          .getSignedUrl({ action: 'read', expires: oneHourFromNow });
        coaSignedUrl = url;
      } else {
        // Already a full URL (e.g. legacy signed URL stored directly)
        coaSignedUrl = product.coaUrl;
      }
    } catch {
      // Non-fatal — COA section simply won't render
    }
  }

  return (
    <>
      <JsonLd schema={buildProductSchema(product)} />
      <JsonLd
        schema={buildBreadcrumbSchema([
          { name: 'Products', href: '/products' },
          { name: product.name, href: `/products/${slug}` },
        ])}
      />
      <ProductDetailClient
        product={product}
        relatedProducts={relatedProducts}
        coaSignedUrl={coaSignedUrl}
        heroImageUrl={heroImageUrl}
        variantPricing={onlineItem?.variantPricing}
        itemInStock={onlineItem?.inStock ?? false}
      />
    </>
  );
}
