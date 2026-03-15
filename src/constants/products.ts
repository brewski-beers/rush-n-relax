import { getDownloadURL, ref } from 'firebase/storage';
import { getStorage$, initializeApp } from '../firebase';
import { PRODUCT_FIXTURES } from '@/lib/fixtures';
import { SITE_URL } from './site';

export interface Product {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string;
  details: string;
  image: string;
}

/**
 * Firebase Storage path convention: products/{slug}.{ext}
 * Supports jpg, png, and webp — resolver tries each in order.
 */
const PRODUCT_IMAGE_EXTENSIONS = ['png', 'jpg', 'webp'] as const;

export const getProductImageStoragePath = (
  slug: string,
  ext: string = 'jpg'
): string => `products/${slug}.${ext}`;

/**
 * Resolve a product image URL from Firebase Storage.
 * Tries png → jpg → webp, returns the first that resolves.
 * Falls back to null if unavailable so the UI can show a placeholder.
 */
export const resolveProductImageUrl = async (
  slug: string
): Promise<string | null> => {
  try {
    initializeApp();
    const storage = getStorage$();
    for (const ext of PRODUCT_IMAGE_EXTENSIONS) {
      try {
        const path = getProductImageStoragePath(slug, ext);
        return await getDownloadURL(ref(storage, path));
      } catch {
        // try next extension
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const PRODUCTS: Product[] = PRODUCT_FIXTURES.map((product, index) => ({
  id: index + 1,
  slug: product.slug,
  name: product.name,
  category: product.category,
  description: product.description,
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
    description: product.description,
    keywords: `${product.name}, ${product.category}, cannabis, dispensary, Tennessee`,
    url: `${SITE_URL}/products/${product.slug}`,
  };
}
