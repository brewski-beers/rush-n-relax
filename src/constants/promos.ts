import { SITE_URL } from './site';

export interface Promo {
  /** Stable unique identifier — safe for Firestore lookup and analytics. */
  promoId: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  details: string;
  cta: string;
  ctaPath: string;
  /** Firebase Storage path, e.g. promos/{slug}.jpg */
  image?: string;
  active: boolean;
}

export const PROMOS: Promo[] = [
  {
    promoId: 'hitoki-laser-bong-2025',
    slug: 'laser-bong',
    name: 'Hitoki Laser Bong',
    tagline: 'Never seen one? Come try it.',
    description:
      "The Hitoki Serquet is the world's first laser-powered bong — combustion replaced by a precision laser for the cleanest, smoothest hit you've ever taken. Come try it at Rush N Relax.",
    details:
      'The Hitoki Serquet uses a high-powered laser instead of a flame, delivering a hit free of butane or torch residue. The result is pure, clean vapor straight from the flower — no combustion byproducts, no harshness, just the full terpene profile of whatever you load. Available to try at any Rush N Relax location. Ask our staff for a walkthrough.',
    cta: 'Find a Location',
    ctaPath: '/locations',
    image: 'promos/laser-bong.png',
    active: true,
  },
];

export function getPromoBySlug(slug: string): Promo | undefined {
  return PROMOS.find(p => p.slug === slug && p.active);
}

export function getPromoByPromoId(promoId: string): Promo | undefined {
  return PROMOS.find(p => p.promoId === promoId && p.active);
}

export function getPromoSEO(promo: Promo) {
  return {
    title: `${promo.name} | Rush N Relax`,
    description: promo.description,
    keywords: `${promo.name}, Rush N Relax, cannabis, dispensary, Tennessee, promo`,
    url: `${SITE_URL}/promo/${promo.slug}`,
    canonical: `${SITE_URL}/promo/${promo.slug}`,
    ogTitle: `${promo.name} — ${promo.tagline}`,
    ogDescription: promo.description,
    ogImage: `${SITE_URL}/og-image.png`,
  };
}
