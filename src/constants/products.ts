import { getDownloadURL, ref } from 'firebase/storage';
import { getStorage$, initializeApp } from '../firebase';

export interface Product {
  id: number;
  slug: string;
  name: string;
  category: 'flower' | 'concentrates' | 'drinks' | 'edibles' | 'vapes';
  description: string;
  details: string;
  image: string;
  featured?: boolean;
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

export const PRODUCTS: Product[] = [
  {
    id: 1,
    slug: 'flower',
    name: 'Premium Flower',
    category: 'flower',
    description:
      'Hand-selected THCa flower — rich terpene profiles, dense buds, and the full-spectrum experience discerning enthusiasts demand.',
    details:
      'Our flower collection is the cornerstone of the Rush N Relax experience. Every strain is hand-selected for potency, aroma, and bag appeal. From earthy indicas that melt away the day to energizing sativas that spark creativity, we carry a rotating lineup of top-shelf cultivars. Ask our staff about current strains, terpene profiles, and what pairs best with your mood.',
    image: 'products/flower.png',
    featured: true,
  },
  {
    id: 2,
    slug: 'concentrates',
    name: 'Premium Concentrates',
    category: 'concentrates',
    description:
      'Refined, potent extracts — crumble, diamonds, live rosin, and more — delivering bold flavor and elevated intensity for the true connoisseur.',
    details:
      'For those who appreciate purity and potency, our concentrate selection sets the bar. Choose from crumble, diamonds, diamond sauce, kief, and live rosin — each lab-tested and selected for exceptional terpene retention and clean extraction. Whether you dab, top a bowl, or vaporize, these concentrates deliver a depth of flavor and effect that flower alone cannot reach.',
    image: 'products/concentrates.png',
    featured: true,
  },
  {
    id: 3,
    slug: 'drinks',
    name: 'THCa Infused Drinks',
    category: 'drinks',
    description:
      'Crisp, refreshing THCa-infused seltzers and beverages — a clean, balanced elevation with every sip.',
    details:
      'Skip the smoke and sip your way to elevation. Our THCa-infused beverage lineup features light, carbonated seltzers in a range of natural flavors, each precisely dosed for a consistent, predictable experience. Low-calorie, fast-acting, and sessionable — they are equally at home at a backyard gathering or a quiet night in. Explore our current flavor rotation in store.',
    image: 'products/drinks.png',
    featured: true,
  },
  {
    id: 4,
    slug: 'edibles',
    name: 'Gourmet Edibles',
    category: 'edibles',
    description:
      'Artisan chocolates, gummies, caramel chews, cookies, and confections that marry luxury taste with precisely dosed effects.',
    details:
      'Edibles are where indulgence meets intention. Our shelves carry artisan chocolates, fruit-forward gummies, rich caramel chews, and freshly inspired cookies — every piece crafted for flavor first and dosed for reliability. Start low, go slow, and savor. Whether you are new to edibles or a seasoned enthusiast, our staff will help you find the perfect treat and dosage.',
    image: 'products/edibles.png',
    featured: true,
  },
  {
    id: 5,
    slug: 'vapes',
    name: 'Sleek Vape Devices',
    category: 'vapes',
    description:
      'Discreet, sophisticated hardware and premium oil cartridges — smooth draws, clean vapor, and effortless portability.',
    details:
      'Our curated vape collection features trusted brands like TribeToke and Wildwoods alongside a rotating selection of premium cartridges and disposables. Every device is chosen for build quality, airflow, and oil compatibility so you get a smooth, flavorful draw every time. Compact enough for your pocket, refined enough for any occasion — vaping has never looked or tasted this good.',
    image: 'products/vapes.png',
    featured: true,
  },
];

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
    url: `https://www.rushnrelax.com/products/${product.slug}`,
  };
}
