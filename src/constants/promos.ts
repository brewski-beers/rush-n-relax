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

export const PROMOS: Promo[] = [
  {
    promoId: 'hitoki-trident-2025',
    slug: 'trident',
    name: 'Hitoki Trident',
    tagline: 'Fire Without Flame.',
    description:
      'The Hitoki Trident uses three precision laser beams to ignite your flower — no butane, no torch, just pure flavor. Try it now at Rush N Relax Seymour, 500 Maryville Hwy.',
    details:
      'The Hitoki Trident replaces your lighter or torch with three high-powered laser beams that ignite flower directly — no butane, no residue, no compromised terpenes. Compatible with standard 14mm water pipes, rechargeable via USB-C, and built for daily use. The result is a noticeably cleaner, more flavorful hit every time. Available to try at Rush N Relax Seymour — 500 Maryville Hwy, Suite 205. Ask our staff for a walkthrough.',
    cta: 'Visit Seymour',
    ctaPath: '/locations/seymour',
    image: 'promos/trident.png',
    locationSlug: 'seymour',
    keywords: [
      'Hitoki Trident',
      'laser lighter',
      'laser ignition',
      'no butane',
      '500 Maryville Hwy',
    ],
    active: true,
  },
];

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
