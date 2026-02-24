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
    description:
      'Home to our signature speakeasy-style lounge and full-service dispensary. Step inside for handpicked flower, concentrates, edibles, and vapes — complemented by a refined lounge where you can settle in, unwind, and enjoy the experience the way it was meant to be.',
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
    description:
      'Situated along Watkins Road in the heart of Blount County, our Maryville dispensary brings a refined retail experience to the foothills of the Smokies. Walk in for expertly curated flower, edibles, concentrates, and vapes — all held to the same exacting standard that defines Rush N Relax.',
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
    description:
      'Nestled along Maryville Highway between Knoxville and the Smokies, our Seymour location offers a relaxed, welcoming atmosphere with the same premium selection you expect from Rush N Relax. Swing by on your way through Sevier County — we make it easy to find exactly what you need.',
    coordinates: { lat: 35.861584, lng: -83.770727 },
    socialLinkIds: [SocialId.FACEBOOK_SEYMOUR],
  },
];

export const getLocationBySlug = (slug: string): Location | undefined => {
  return LOCATIONS.find(loc => loc.slug === slug);
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
