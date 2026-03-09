/**
 * Firestore document shape for a promotion.
 * Lives at: tenants/{tenantId}/promos/{promoId}
 */
export interface Promo {
  /** Firestore document ID (same as promoId for backwards compatibility) */
  id: string;
  tenantId: string;
  /** Stable human-readable identifier, e.g. 'hitoki-laser-bong-2025' */
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
  /** Restricts the promo to a specific location slug, e.g. 'seymour' */
  locationSlug?: string;
  /** Additional SEO keywords co-located with data */
  keywords?: string[];
  active: boolean;
  /** ISO date string or null if promo runs indefinitely */
  startDate?: string;
  /** ISO date string — promo is auto-noindexed after this date */
  endDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PromoSummary = Pick<
  Promo,
  | 'id'
  | 'slug'
  | 'name'
  | 'tagline'
  | 'image'
  | 'active'
  | 'endDate'
  | 'locationSlug'
>;
