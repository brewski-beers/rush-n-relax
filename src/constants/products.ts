export interface Product {
  id: number;
  slug: string;
  name: string;
  category: 'concentrates' | 'drinks' | 'edibles' | 'vapes';
  description: string;
  details: string;
  image?: string;
  featured?: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: 1,
    slug: 'concentrates',
    name: 'Premium Concentrates',
    category: 'concentrates',
    description: 'Refined, potent extracts delivering bold flavors and an unmatched high for the true enthusiasts.',
    details: 'Experience our curated selection of high-quality concentrates including crumble, diamonds, diamond sauce, kief, and live rosin. Each product is carefully selected to deliver premium potency and flavor profiles that elevate your experience to the next level.',
    featured: true,
  },
  {
    id: 2,
    slug: 'drinks',
    name: 'THCa Infused Drinks',
    category: 'drinks',
    description: 'Crisp, refreshing THCa infused seltzers that deliver a clean, balanced elevation with every sip.',
    details: 'Our premium THCa infused beverage collection offers a sophisticated way to enjoy cannabis. Each refreshing sip delivers a perfectly balanced, clean elevation. Perfect for social occasions or personal relaxation.',
    featured: true,
  },
  {
    id: 3,
    slug: 'edibles',
    name: 'Gourmet Edibles',
    category: 'edibles',
    description: 'Gourmet-infused chocolates, gummies, caramel chews, cookies, and other treats that blend luxury taste with elevated effects.',
    details: 'Indulge in our selection of premium edibles. From artisanal chocolates to gourmet gummies, caramel chews, and specialty cookies – each treat is crafted to deliver both exceptional flavor and consistent effects. Perfect for discerning cannabis connoisseurs.',
    featured: true,
  },
  {
    id: 4,
    slug: 'vapes',
    name: 'Sleek Vape Devices',
    category: 'vapes',
    description: 'Sleek, sophisticated, and discreet devices offering smooth pulls, premium oils, and effortless enjoyment.',
    details: 'Browse our collection of premium vape devices featuring brands such as TribeToke and Wildwoods. Each device is selected for superior smooth pulls, premium oil compatibility, and discreet sophistication for the modern cannabis enthusiast.',
    featured: true,
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}

export function getProductSEO(product: Product) {
  return {
    title: `${product.name} | Rush N Relax Premium Cannabis`,
    description: product.description,
    keywords: `${product.name}, ${product.category}, cannabis, dispensary, Tennessee`,
    url: `https://www.rushnrelax.com/products/${product.slug}`,
  };
}
