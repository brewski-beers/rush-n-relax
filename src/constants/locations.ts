import { SocialId } from './social';
import { LOCATION_FIXTURES } from '@/lib/fixtures';
import { SITE_URL } from './site';

export interface Location {
  id: number;
  slug: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  hours: string;
  description: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  socialLinkIds?: SocialId[];
  placeId: string; // Google Maps Place ID — used to fetch live reviews and ratings
}

export const LOCATIONS: Location[] = LOCATION_FIXTURES.map(
  (location, index) => ({
    id: index + 1,
    slug: location.slug,
    name: location.name,
    address: location.address,
    city: location.city,
    state: location.state,
    zip: location.zip,
    phone: location.phone,
    hours: location.hours,
    description: location.description,
    coordinates: location.coordinates,
    socialLinkIds: location.socialLinkIds,
    placeId: location.placeId ?? '',
  })
);

export const getLocationBySlug = (slug: string): Location | undefined => {
  return LOCATIONS.find(loc => loc.slug === slug);
};

export const getLocationSEO = (location: Location) => {
  return {
    title: `${location.name} - Rush N Relax Premium Cannabis`,
    description: `${location.description} Located at ${location.address}, ${location.city}, ${location.state}. Call ${location.phone} for more information.`,
    keywords: `cannabis, dispensary, ${location.city}, ${location.state}, premium cannabis`,
    url: `${SITE_URL}/locations/${location.slug}`,
    type: 'LocalBusiness',
  };
};
