import { SocialId } from './social';

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
}

export const LOCATIONS: Location[] = [
  {
    id: 1,
    slug: 'oak-ridge',
    name: 'Oak Ridge',
    address: '110 Bus Terminal Road',
    city: 'Oak Ridge',
    state: 'TN',
    zip: '37830',
    phone: '+1 (865) 936-3069',
    hours: 'Mon-Sun: 10am - 10pm',
    description: 'Experience premium cannabis retail and our signature speakeasy-style lounge in Oak Ridge. Expert guidance in a sophisticated atmosphere.',
    coordinates: { lat: 36.023978, lng: -84.24072 },
    socialLinkIds: [SocialId.FACEBOOK_OAK_RIDGE],
  },
  {
    id: 2,
    slug: 'maryville',
    name: 'Maryville',
    address: '729 Watkins Road',
    city: 'Maryville',
    state: 'TN',
    zip: '37801',
    phone: '+1 (865) 265-4102',
    hours: 'Mon-Sun: 10am - 10pm',
    description: 'Experience premium cannabis retail in Maryville. Upscale atmosphere with carefully curated selection and expert service.',
    coordinates: { lat: 35.750658, lng: -83.992662 },
    socialLinkIds: [SocialId.FACEBOOK_MARYVILLE],
  },
  {
    id: 3,
    slug: 'seymour',
    name: 'Seymour',
    address: '500 Maryville Hwy, Suite 205',
    city: 'Seymour',
    state: 'TN',
    zip: '37865',
    phone: '+1 (865) 415-4225',
    hours: 'Mon-Sun: 10am - 10pm',
    description: 'Experience premium cannabis retail in Seymour. Relaxed lounge environment with expert selection and welcoming hospitality.',
    coordinates: { lat: 35.861584, lng: -83.770727 },
    socialLinkIds: [SocialId.FACEBOOK_SEYMOUR],
  },
  {
    id: 4,
    slug: 'knoxville',
    name: 'Knoxville',
    address: '4001 Bruhin Road',
    city: 'Knoxville',
    state: 'TN',
    zip: '37918',
    phone: '+1 (865) 936-3069',
    hours: 'Coming soon',
    description: 'Exciting new location coming to Knoxville. Stay tuned for opening details and exclusive launch information.',
    coordinates: { lat: 36.001233, lng: -83.955442 },
  },
];

export const getLocationBySlug = (slug: string): Location | undefined => {
  return LOCATIONS.find((loc) => loc.slug === slug);
};

export const getLocationSEO = (location: Location) => {
  return {
    title: `${location.name} - Rush N Relax Premium Cannabis`,
    description: `${location.description} Located at ${location.address}, ${location.city}, ${location.state}. Call ${location.phone} for more information.`,
    keywords: `cannabis, dispensary, ${location.city}, ${location.state}, premium cannabis`,
    url: `https://www.rushnrelax.com/locations/${location.slug}`,
    type: 'LocalBusiness',
  };
};
