import { PRODUCT_FIXTURES } from '@/lib/fixtures';
import { SITE_URL } from './site';

export interface Product {
  id: number;
  slug: string;
  name: string;
  category: string;
  details: string;
  image: string;
}

export const PRODUCTS: Product[] = PRODUCT_FIXTURES.map((product, index) => ({
  id: index + 1,
  slug: product.slug,
  name: product.name,
  category: product.category,
  details: product.details,
  image: product.image ?? '',
}));

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find(p => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  return PRODUCTS.filter(p => p.category === category);
}

export function getProductSEO(product: Product) {
  return {
    title: `${product.name} | Rush N Relax Premium Cannabis`,
    description: product.details,
    keywords: `${product.name}, ${product.category}, cannabis, dispensary, Tennessee`,
    url: `${SITE_URL}/products/${product.slug}`,
  };
}
