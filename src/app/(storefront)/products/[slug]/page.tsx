import { notFound } from 'next/navigation';
import { getProductBySlug, listProducts } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo/metadata.factory';
import { buildProductSchema } from '@/lib/seo/schemas/product';
import { buildBreadcrumbSchema } from '@/lib/seo/schemas/breadcrumb';
import { JsonLd } from '@/components/JsonLd';
import { seoConfig } from '@/config/seo.config';
import ProductDetailClient from './ProductDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  return buildMetadata('/products/[slug]', {
    title: `${product.name} — Premium Cannabis | Rush N Relax`,
    description: product.description,
    canonical: `${seoConfig.site.domain}/products/${slug}`,
    path: `/products/${slug}`,
  });
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const [product, activeProducts] = await Promise.all([
    getProductBySlug(slug),
    listProducts(),
  ]);
  if (!product || product.status === 'archived') notFound();

  const relatedProducts = activeProducts
    .filter(candidate => candidate.slug !== product.slug)
    .slice(0, 3);

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
      />
    </>
  );
}
