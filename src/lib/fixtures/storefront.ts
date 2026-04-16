import type { SocialId } from '@/constants/social';
import type {
  GoogleReview,
  Location,
  LocationSummary,
  Product,
  ProductCategoryConfig,
  Promo,
} from '@/types';
import type { InventoryItem } from '@/types/inventory';
import type { VariantTemplate } from '@/types/variant-template';
import { ONLINE_LOCATION_ID } from '@/constants/location-ids';

export const FIXTURE_DATASET_VERSION = '2026-03-14';
export const FIXTURE_TIMESTAMP = '2026-03-14T00:00:00.000Z';

export interface LocationFixture {
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
  placeId?: string;
  seoDescription?: string;
}

export interface ProductFixture {
  slug: string;
  name: string;
  category: Product['category'];
  details: string;
  image?: string;
  status: Product['status'];
  federalDeadlineRisk: boolean;
  availableAt?: string[];
  coaUrl?: string;
}

export interface InventoryItemFixture {
  locationId: string;
  productId: string;
  inStock: boolean;
  availableOnline: boolean;
  availablePickup: boolean;
  featured: boolean;
  quantity: number;
  variantPricing?: InventoryItem['variantPricing'];
}

export interface PromoFixture {
  promoId: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  details: string;
  cta: string;
  ctaPath: string;
  image?: string;
  locationSlug?: string;
  keywords?: string[];
  active: boolean;
  startDate?: string;
  endDate?: string;
}

export interface CategoryFixture {
  slug: string;
  label: string;
  description: string;
  order: number;
  isActive: boolean;
}

export interface LocationReviewFixture {
  placeId: string;
  rating: number;
  totalRatings: number;
  reviews: GoogleReview[];
  cachedAt: number;
}

const fixtureDate = new Date(FIXTURE_TIMESTAMP);

export const LOCATION_FIXTURES: readonly LocationFixture[] = [
  {
    slug: 'oak-ridge',
    name: 'Oak Ridge',
    address: '110 Bus Terminal Road',
    city: 'Oak Ridge',
    state: 'TN',
    zip: '37830',
    phone: '+1 (865) 936-3069',
    hours: 'Mon-Sun: 10am - 10pm',
    description:
      'Home to our signature speakeasy-style lounge and full-service dispensary. Step inside for handpicked flower, concentrates, edibles, and vapes - complemented by a refined lounge where you can settle in, unwind, and enjoy the experience the way it was meant to be.',
    coordinates: { lat: 36.023978, lng: -84.24072 },
    socialLinkIds: ['fb_oak_ridge' as SocialId],
    placeId: 'ChIJG2IBn08zXIgROk6xAd9qyY0',
  },
  {
    slug: 'maryville',
    name: 'Maryville',
    address: '729 Watkins Road',
    city: 'Maryville',
    state: 'TN',
    zip: '37801',
    phone: '+1 (865) 265-4102',
    hours: 'Mon-Sun: 10am - 10pm',
    description:
      'Situated along Watkins Road in the heart of Blount County, our Maryville dispensary brings a refined retail experience to the foothills of the Smokies. Walk in for expertly curated flower, edibles, concentrates, and vapes - all held to the same exacting standard that defines Rush N Relax.',
    coordinates: { lat: 35.750658, lng: -83.992662 },
    socialLinkIds: ['fb_maryville' as SocialId],
    placeId: 'ChIJHZao5_GfXogR9G9vWnFH3IM',
  },
  {
    slug: 'seymour',
    name: 'Seymour',
    address: '500 Maryville Hwy, Suite 205',
    city: 'Seymour',
    state: 'TN',
    zip: '37865',
    phone: '+1 (865) 936-2040',
    hours: 'Mon-Sun: 10am - 10pm',
    description:
      'Nestled along Maryville Highway between Knoxville and the Smokies, our Seymour location offers a relaxed, welcoming atmosphere with the same premium selection you expect from Rush N Relax. Swing by on your way through Sevier County - we make it easy to find exactly what you need.',
    coordinates: { lat: 35.861584, lng: -83.770727 },
    socialLinkIds: ['fb_seymour' as SocialId],
    placeId: 'ChIJb1IipsQbXIgREaNxkmmAaHg',
  },
];

export const LOCATION_SLUGS = LOCATION_FIXTURES.map(location => location.slug);

export const CATEGORY_FIXTURES: readonly CategoryFixture[] = [
  {
    slug: 'flower',
    label: 'Flower',
    description: 'Hand-selected THCa flower strains',
    order: 1,
    isActive: true,
  },
  {
    slug: 'concentrates',
    label: 'Concentrates',
    description: 'Refined, potent extracts',
    order: 2,
    isActive: true,
  },
  {
    slug: 'drinks',
    label: 'Drinks',
    description: 'THCa-infused beverages',
    order: 3,
    isActive: true,
  },
  {
    slug: 'edibles',
    label: 'Edibles',
    description: 'Gourmet edibles and treats',
    order: 4,
    isActive: true,
  },
  {
    slug: 'vapes',
    label: 'Vapes',
    description: 'Discreet vape hardware',
    order: 5,
    isActive: true,
  },
];

export const PRODUCT_FIXTURES: readonly ProductFixture[] = [
  {
    slug: 'flower',
    name: 'Premium Flower',
    category: 'flower',
    details:
      'Our flower collection is the cornerstone of the Rush N Relax experience. Every strain is hand-selected for potency, aroma, and bag appeal. From earthy indicas that melt away the day to energizing sativas that spark creativity, we carry a rotating lineup of top-shelf cultivars. Ask our staff about current strains, terpene profiles, and what pairs best with your mood.',
    image: 'products/flower.png',
    status: 'active',
    federalDeadlineRisk: true,
  },
  {
    slug: 'concentrates',
    name: 'Premium Concentrates',
    category: 'concentrates',
    details:
      'For those who appreciate purity and potency, our concentrate selection sets the bar. Choose from crumble, diamonds, diamond sauce, kief, and live rosin - each lab-tested and selected for exceptional terpene retention and clean extraction. Whether you dab, top a bowl, or vaporize, these concentrates deliver a depth of flavor and effect that flower alone cannot reach.',
    image: 'products/concentrates.png',
    status: 'active',
    federalDeadlineRisk: true,
  },
  {
    slug: 'drinks',
    name: 'THCa Infused Drinks',
    category: 'drinks',
    details:
      'Skip the smoke and sip your way to elevation. Our THCa-infused beverage lineup features light, carbonated seltzers in a range of natural flavors, each precisely dosed for a consistent, predictable experience. Low-calorie, fast-acting, and sessionable - they are equally at home at a backyard gathering or a quiet night in. Explore our current flavor rotation in store.',
    image: 'products/drinks.png',
    status: 'active',
    federalDeadlineRisk: true,
  },
  {
    slug: 'edibles',
    name: 'Gourmet Edibles',
    category: 'edibles',
    details:
      'Edibles are where indulgence meets intention. Our shelves carry artisan chocolates, fruit-forward gummies, rich caramel chews, and freshly inspired cookies - every piece crafted for flavor first and dosed for reliability. Start low, go slow, and savor. Whether you are new to edibles or a seasoned enthusiast, our staff will help you find the perfect treat and dosage.',
    image: 'products/edibles.png',
    status: 'active',
    federalDeadlineRisk: true,
  },
  {
    slug: 'vapes',
    name: 'Sleek Vape Devices',
    category: 'vapes',
    details:
      'Our curated vape collection features trusted brands like TribeToke and Wildwoods alongside a rotating selection of premium cartridges and disposables. Every device is chosen for build quality, airflow, and oil compatibility so you get a smooth, flavorful draw every time. Compact enough for your pocket, refined enough for any occasion - vaping has never looked or tasted this good.',
    image: 'products/vapes.png',
    status: 'active',
    federalDeadlineRisk: false,
  },
];

/** Hub inventory seed — all products available online and featured by default. */
export const HUB_INVENTORY_FIXTURES: readonly InventoryItemFixture[] =
  PRODUCT_FIXTURES.map(p => ({
    locationId: 'hub',
    productId: p.slug,
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: true,
    quantity: 99,
  }));

/** Online virtual location inventory — canonical source for storefront variant pricing. */
export const ONLINE_INVENTORY_FIXTURES: readonly InventoryItemFixture[] = [
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'flower',
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: true,
    quantity: 99,
    variantPricing: {
      '1g': { price: 1000 },
      '3-5g': { price: 2800 },
      '7g': { price: 5000 },
      '14g': { price: 9000, compareAtPrice: 10000 },
      '28g': { price: 16000, compareAtPrice: 18000 },
    },
  },
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'concentrates',
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: true,
    quantity: 99,
    variantPricing: {
      '0-5g': { price: 2500 },
      '1g': { price: 4500, compareAtPrice: 5000 },
    },
  },
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'drinks',
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: false,
    quantity: 99,
    variantPricing: {
      'single-can': { price: 800 },
      '2-pack': { price: 1400 },
    },
  },
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'edibles',
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: false,
    quantity: 99,
    variantPricing: {
      '10mg': { price: 500 },
      '25mg': { price: 1000 },
      '50mg': { price: 1800, compareAtPrice: 2000 },
    },
  },
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'vapes',
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: false,
    quantity: 99,
    variantPricing: {
      '0-5g-cart': { price: 2000 },
      '1g-cart': { price: 3500 },
      'disposable-1g': { price: 4000, compareAtPrice: 4500 },
    },
  },
];

export const PROMO_FIXTURES: readonly PromoFixture[] = [
  {
    promoId: 'hitoki-laser-bong-2025',
    slug: 'laser-bong',
    name: 'Hitoki Trident',
    tagline: 'Fire Without Flame.',
    description:
      'The Hitoki Trident uses three precision laser beams to ignite your flower - no butane, no torch, just pure flavor. Try it now at Rush N Relax Seymour, 500 Maryville Hwy.',
    details:
      'The Hitoki Trident replaces your lighter or torch with three high-powered laser beams that ignite flower directly - no butane, no residue, no compromised terpenes. Compatible with standard 14mm water pipes, rechargeable via USB-C, and built for daily use. The result is a noticeably cleaner, more flavorful hit every time. Available to try at Rush N Relax Seymour - 500 Maryville Hwy, Suite 205. Ask our staff for a walkthrough.',
    cta: 'Visit Seymour',
    ctaPath: '/locations/seymour',
    image: 'promos/laser-bong.png',
    locationSlug: 'seymour',
    keywords: [
      'Hitoki Trident',
      'laser bong',
      'laser powered bong',
      'laser lighter',
      'laser ignition',
      'no butane',
      '500 Maryville Hwy',
    ],
    active: true,
  },
];

export const LOCATION_REVIEW_FIXTURES: readonly LocationReviewFixture[] = [
  {
    placeId: 'ChIJG2IBn08zXIgROk6xAd9qyY0',
    rating: 4.8,
    totalRatings: 312,
    reviews: [
      {
        author_name: 'Jane D.',
        rating: 5,
        text: 'Incredible selection and knowledgeable staff. Best dispensary in Oak Ridge!',
        relative_time_description: '2 days ago',
        profile_photo_url: '',
        time: 1700900000,
      },
      {
        author_name: 'Marcus H.',
        rating: 5,
        text: 'My go-to spot. Always clean, always friendly. Highly recommend!',
        relative_time_description: '1 week ago',
        profile_photo_url: '',
        time: 1700400000,
      },
      {
        author_name: 'Patricia L.',
        rating: 5,
        text: 'Top notch products and amazing service every single time.',
        relative_time_description: '2 weeks ago',
        profile_photo_url: '',
        time: 1699800000,
      },
      {
        author_name: 'Ryan K.',
        rating: 5,
        text: 'Staff really knows their stuff. Made great recommendations for my needs.',
        relative_time_description: '3 weeks ago',
        profile_photo_url: '',
        time: 1699200000,
      },
      {
        author_name: 'Sandra W.',
        rating: 5,
        text: 'Love this place. Great atmosphere and unbeatable prices.',
        relative_time_description: '1 month ago',
        profile_photo_url: '',
        time: 1698600000,
      },
    ],
    cachedAt: 1700000000001,
  },
  {
    placeId: 'ChIJb1IipsQbXIgREaNxkmmAaHg',
    rating: 4.7,
    totalRatings: 198,
    reviews: [
      {
        author_name: 'Mark T.',
        rating: 5,
        text: 'Friendly staff, great selection. Worth the drive every time!',
        relative_time_description: '3 days ago',
        profile_photo_url: '',
        time: 1700800000,
      },
      {
        author_name: 'Angela R.',
        rating: 5,
        text: "Best experience I've had at any dispensary. Super knowledgeable team.",
        relative_time_description: '5 days ago',
        profile_photo_url: '',
        time: 1700700000,
      },
      {
        author_name: 'Derek S.',
        rating: 5,
        text: 'Always stocked with quality products. My favorite location.',
        relative_time_description: '1 week ago',
        profile_photo_url: '',
        time: 1700300000,
      },
      {
        author_name: 'Karen M.',
        rating: 5,
        text: 'So professional and welcoming. Five stars every visit.',
        relative_time_description: '2 weeks ago',
        profile_photo_url: '',
        time: 1699700000,
      },
      {
        author_name: 'Tony B.',
        rating: 5,
        text: 'Great deals and even better service. Highly recommended!',
        relative_time_description: '3 weeks ago',
        profile_photo_url: '',
        time: 1699100000,
      },
    ],
    cachedAt: 1700000000002,
  },
  {
    placeId: 'ChIJHZao5_GfXogR9G9vWnFH3IM',
    rating: 4.9,
    totalRatings: 54,
    reviews: [
      {
        author_name: 'Laura M.',
        rating: 5,
        text: 'Absolutely love this location. Staff is friendly and very knowledgeable.',
        relative_time_description: '1 day ago',
        profile_photo_url: '',
        time: 1700950000,
      },
      {
        author_name: 'Chris B.',
        rating: 5,
        text: 'Great atmosphere and top-shelf products. My new favorite spot.',
        relative_time_description: '4 days ago',
        profile_photo_url: '',
        time: 1700750000,
      },
      {
        author_name: 'Tammy R.',
        rating: 5,
        text: 'Always a pleasure. Clean store, great selection, helpful team.',
        relative_time_description: '1 week ago',
        profile_photo_url: '',
        time: 1700350000,
      },
      {
        author_name: 'James H.',
        rating: 5,
        text: 'Came in not knowing what I wanted and left perfectly taken care of.',
        relative_time_description: '2 weeks ago',
        profile_photo_url: '',
        time: 1699750000,
      },
      {
        author_name: 'Nicole K.',
        rating: 5,
        text: 'Best dispensary in Blount County. Will absolutely be back.',
        relative_time_description: '3 weeks ago',
        profile_photo_url: '',
        time: 1699150000,
      },
    ],
    cachedAt: 1700000000003,
  },
];

export function buildLocationDocuments(date: Date = fixtureDate): Location[] {
  return LOCATION_FIXTURES.map(location => ({
    id: location.slug,
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
    placeId: location.placeId,
    seoDescription: location.seoDescription,
    createdAt: date,
    updatedAt: date,
  }));
}

export function buildLocationSummaries(): LocationSummary[] {
  return buildLocationDocuments().map(location => ({
    id: location.id,
    slug: location.slug,
    name: location.name,
    address: location.address,
    city: location.city,
    state: location.state,
    zip: location.zip,
    phone: location.phone,
    hours: location.hours,
    placeId: location.placeId,
    coordinates: location.coordinates,
  }));
}

export function buildProductDocuments(date: Date = fixtureDate): Product[] {
  return PRODUCT_FIXTURES.map(product => ({
    id: product.slug,
    slug: product.slug,
    name: product.name,
    category: product.category,
    details: product.details,
    image: product.image,
    status: product.status,
    federalDeadlineRisk: product.federalDeadlineRisk,
    coaUrl: product.coaUrl,
    availableAt: product.availableAt ?? [...LOCATION_SLUGS],
    createdAt: date,
    updatedAt: date,
  }));
}

export function buildHubInventoryDocuments(
  date: Date = fixtureDate
): InventoryItem[] {
  return HUB_INVENTORY_FIXTURES.map(item => ({
    productId: item.productId,
    locationId: item.locationId,
    inStock: item.inStock,
    availableOnline: item.availableOnline,
    availablePickup: item.availablePickup,
    featured: item.featured,
    quantity: item.quantity,
    updatedAt: date,
  }));
}

export function buildOnlineInventoryDocuments(
  date: Date = fixtureDate
): InventoryItem[] {
  return ONLINE_INVENTORY_FIXTURES.map(item => ({
    productId: item.productId,
    locationId: item.locationId,
    inStock: item.inStock,
    availableOnline: item.availableOnline,
    availablePickup: item.availablePickup,
    featured: item.featured,
    quantity: item.quantity,
    variantPricing: item.variantPricing,
    updatedAt: date,
  }));
}

export function buildPromoDocuments(date: Date = fixtureDate): Promo[] {
  return PROMO_FIXTURES.map(promo => ({
    id: promo.slug,
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
    startDate: promo.startDate,
    endDate: promo.endDate,
    createdAt: date,
    updatedAt: date,
  }));
}

export const VARIANT_TEMPLATE_FIXTURES: readonly Omit<
  VariantTemplate,
  'id' | 'createdAt' | 'updatedAt'
>[] = [
  {
    key: 'flower',
    label: 'Flower (weight)',
    rows: [
      { label: '1g', weight: { value: 1, unit: 'g' } },
      { label: '3.5g', weight: { value: 3.5, unit: 'g' } },
      { label: '7g', weight: { value: 7, unit: 'g' } },
      { label: '14g', weight: { value: 14, unit: 'g' } },
      { label: '28g', weight: { value: 28, unit: 'g' } },
    ],
  },
  {
    key: 'preroll-qty',
    label: 'Preroll (qty)',
    rows: [
      { label: '1-pack', quantity: 1 },
      { label: '2-pack', quantity: 2 },
      { label: '5-pack', quantity: 5 },
    ],
  },
  {
    key: 'preroll-weight',
    label: 'Preroll (weight)',
    rows: [
      { label: '0.5g', weight: { value: 0.5, unit: 'g' } },
      { label: '0.75g', weight: { value: 0.75, unit: 'g' } },
      { label: '1g', weight: { value: 1, unit: 'g' } },
      { label: '1.5g', weight: { value: 1.5, unit: 'g' } },
    ],
  },
  {
    key: 'concentrate',
    label: 'Concentrate',
    rows: [
      { label: '0.5g', weight: { value: 0.5, unit: 'g' } },
      { label: '1g', weight: { value: 1, unit: 'g' } },
    ],
  },
  {
    key: 'edible',
    label: 'Edible (free-form)',
    rows: [{ label: '' }],
  },
  {
    key: 'vape',
    label: 'Vape',
    rows: [
      { label: '0.5g cart', weight: { value: 0.5, unit: 'g' } },
      { label: '1g cart', weight: { value: 1, unit: 'g' } },
      { label: 'Disposable 1g', weight: { value: 1, unit: 'g' } },
    ],
  },
  {
    key: 'drink',
    label: 'Drink',
    rows: [
      { label: 'Single Can', quantity: 1 },
      { label: '2-pack', quantity: 2 },
    ],
  },
  {
    key: 'single',
    label: 'Single / 1-pack',
    rows: [{ label: '1-pack', quantity: 1 }],
  },
  {
    key: 'custom',
    label: 'Custom',
    rows: [{ label: '' }],
  },
];

export function buildVariantTemplateDocuments(
  fixtureDate: Date
): VariantTemplate[] {
  return VARIANT_TEMPLATE_FIXTURES.map(t => ({
    ...t,
    id: t.key,
    createdAt: fixtureDate,
    updatedAt: fixtureDate,
  }));
}

export function buildCategoryDocuments(
  date: Date = fixtureDate
): ProductCategoryConfig[] {
  return CATEGORY_FIXTURES.map(cat => ({
    slug: cat.slug,
    label: cat.label,
    description: cat.description,
    order: cat.order,
    isActive: cat.isActive,
    createdAt: date,
    updatedAt: date,
  }));
}
