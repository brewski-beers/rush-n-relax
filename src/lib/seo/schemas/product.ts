/**
 * Product schema factory.
 * Used on product detail pages (/products/[slug]).
 * NOTE: health claims are NOT placed in description per compliance rules.
 */
import { seoConfig } from '@/config/seo.config';
import type { Product } from '@/types';

export function buildProductSchema(product: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.details,
    url: `${seoConfig.site.domain}/products/${product.slug}`,
    ...(product.image && {
      image: product.image.startsWith('http')
        ? product.image
        : `${seoConfig.site.domain}/${product.image}`,
    }),
    brand: {
      '@type': 'Brand',
      name: 'Rush N Relax',
    },
    offers: {
      '@type': 'Offer',
      availability:
        product.status === 'active'
          ? 'https://schema.org/InStoreOnly'
          : 'https://schema.org/Discontinued',
      seller: {
        '@type': 'Organization',
        name: 'Rush N Relax',
      },
    },
  };
}
