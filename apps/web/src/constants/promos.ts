import { PROMO_FIXTURES } from '@/lib/fixtures';
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
  /** Restricts the promo to a specific location slug (e.g. 'seymour') */
  locationSlug?: string;
  /** Additional SEO keywords specific to this promo (co-located with the data, not buried in utils) */
  keywords?: string[];
  active: boolean;
}

export const PROMOS: Promo[] = PROMO_FIXTURES.map(promo => ({
  promoId: promo.promoId,
  slug: promo.slug,
  name: promo.name,
  tagline: promo.tagline,
  description: promo.description,
  details: promo.details,
  cta: promo.cta,
  ctaPath: promo.ctaPath,
  image: promo.image,
  locationSlug: promo.locationSlug,
  keywords: promo.keywords,
  active: promo.active,
}));

export function getPromoBySlug(slug: string): Promo | undefined {
  return PROMOS.find(p => p.slug === slug && p.active);
}

export function getPromoByPromoId(promoId: string): Promo | undefined {
  return PROMOS.find(p => p.promoId === promoId && p.active);
}

export function getPromosByLocationSlug(locationSlug: string): Promo[] {
  return PROMOS.filter(p => p.locationSlug === locationSlug && p.active);
}

export function getPromoSEO(promo: Promo) {
  const keywords = [
    promo.name,
    promo.tagline,
    'Rush N Relax',
    'cannabis dispensary',
    'Tennessee dispensary',
    ...(promo.locationSlug
      ? [
          promo.locationSlug,
          `Rush N Relax ${promo.locationSlug}`,
          `${promo.locationSlug} TN dispensary`,
        ]
      : []),
    ...(promo.keywords ?? []),
  ];
  return {
    title: `${promo.name} | Rush N Relax`,
    description: promo.description,
    keywords: keywords.join(', '),
    url: `${SITE_URL}/promo/${promo.slug}`,
    canonical: `${SITE_URL}/promo/${promo.slug}`,
    ogTitle: `${promo.name} — ${promo.tagline}`,
    ogDescription: promo.description,
    ogImage: `${SITE_URL}/og-image.png`,
  };
}
