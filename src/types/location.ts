import type { SocialId } from '@/constants/social';

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

/**
 * Firestore document shape for a dispensary location.
 * Lives at: tenants/{tenantId}/locations/{locationId}
 */
export interface Location {
  /** Firestore document ID */
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  /** Human-readable hours string, e.g. "Mon-Sun: 10am - 10pm" */
  hours: string;
  description: string;
  coordinates?: LocationCoordinates;
  socialLinkIds?: SocialId[];
  /** Google Maps Place ID — used to fetch live reviews and ratings */
  placeId: string;
  /** Clover merchant ID for this specific location */
  cloverMerchantId?: string;
  /** Firebase Storage path for OG image, e.g. locations/{slug}/og.jpg */
  ogImagePath?: string;
  /** SEO description override (falls back to description if absent) */
  seoDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lightweight shape for list views (locations index page).
 * Does not include description/seoDescription to keep payload small.
 */
export type LocationSummary = Pick<
  Location,
  | 'id'
  | 'slug'
  | 'name'
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'phone'
  | 'hours'
  | 'placeId'
  | 'coordinates'
>;
