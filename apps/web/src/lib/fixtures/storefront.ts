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
import { ONLINE_LOCATION_ID } from '../../constants/location-ids';

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
  notes?: string;
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

/**
 * TEST DATA — not real operational values.
 * Addresses, phones, and placeIds are intentionally fake so emulator data
 * is never confused with prod and schema drift is immediately visible.
 * Coordinates are real-ish (correct region) to keep map component tests meaningful.
 */
// ⚠️  FIXTURE DATA — every field below is invented. No real addresses, phones,
//    coordinates, or place IDs. Slugs oak-ridge/maryville/seymour are kept as
//    stable identifiers for inventory fixture references only.
export const LOCATION_FIXTURES: readonly LocationFixture[] = [
  {
    slug: 'oak-ridge',
    name: 'Pinecrest',
    address: '42 Ember Lane',
    city: 'Pinecrest',
    state: 'XX',
    zip: '00001',
    phone: '+1 (555) 010-0001',
    hours: 'Mon-Sun: 10am - 10pm',
    description:
      'Home to our signature speakeasy-style lounge and full-service dispensary. Step inside for handpicked flower, concentrates, edibles, and vapes - complemented by a refined lounge where you can settle in, unwind, and enjoy the experience the way it was meant to be.',
    coordinates: { lat: 10.001, lng: -10.001 },
    socialLinkIds: ['fb_oak_ridge' as SocialId],
    placeId: 'fixture-place-id-oak-ridge',
  },
  {
    slug: 'maryville',
    name: 'Bluffton',
    address: '7 Canopy Court',
    city: 'Bluffton',
    state: 'XX',
    zip: '00002',
    phone: '+1 (555) 010-0002',
    hours: 'Mon-Sun: 10am - 10pm',
    description:
      'A refined retail experience in the heart of Bluffton. Walk in for expertly curated flower, edibles, concentrates, and vapes - all held to the same exacting standard that defines Rush N Relax.',
    coordinates: { lat: 10.002, lng: -10.002 },
    socialLinkIds: ['fb_maryville' as SocialId],
    placeId: 'fixture-place-id-maryville',
  },
  {
    slug: 'seymour',
    name: 'Hartwell',
    address: '19 Ridgeline Drive, Suite 205',
    city: 'Hartwell',
    state: 'XX',
    zip: '00003',
    phone: '+1 (555) 010-0003',
    hours: 'Mon-Sun: 10am - 10pm',
    description:
      'Our Hartwell location offers a relaxed, welcoming atmosphere with the same premium selection you expect from Rush N Relax. Stop by anytime — we make it easy to find exactly what you need.',
    coordinates: { lat: 10.003, lng: -10.003 },
    socialLinkIds: ['fb_seymour' as SocialId],
    placeId: 'fixture-place-id-seymour',
  },
  {
    slug: 'crestwood',
    name: 'Crestwood Station',
    address: '88 Vaulted Hollow Rd',
    city: 'Crestwood',
    state: 'XX',
    zip: '00004',
    phone: '+1 (555) 010-0004',
    hours: 'Mon-Sat: 10am - 9pm',
    description:
      'Crestwood Station brings the full Rush N Relax experience to a bright, modern retail floor with a curated selection of flower, vapes, edibles, and more.',
    coordinates: { lat: 10.004, lng: -10.004 },
    placeId: 'fixture-place-id-crestwood',
  },
  {
    slug: 'thornvale',
    name: 'Thornvale',
    address: '3 Seedling Square',
    city: 'Thornvale',
    state: 'XX',
    zip: '00005',
    phone: '+1 (555) 010-0005',
    hours: 'Mon-Sun: 11am - 8pm',
    description:
      'Tucked into the Thornvale town center, this cozy outpost carries a focused selection of our best-selling flower, pre-rolls, and edibles.',
    coordinates: { lat: 10.005, lng: -10.005 },
    placeId: 'fixture-place-id-thornvale',
  },
  {
    slug: 'lakemoor',
    name: 'Lakemoor',
    address: '512 Fixture Pkwy',
    city: 'Lakemoor',
    state: 'XX',
    zip: '00006',
    phone: '+1 (555) 010-0006',
    hours: 'Mon-Fri: 10am - 9pm, Sat-Sun: 9am - 10pm',
    description:
      'Our Lakemoor shop sits just off the main strip with ample parking and a warm, knowledgeable team ready to guide you through every category.',
    coordinates: { lat: 10.006, lng: -10.006 },
    placeId: 'fixture-place-id-lakemoor',
  },
  {
    slug: 'dunmore',
    name: 'Dunmore Crossing',
    address: '200 Test Node Blvd',
    city: 'Dunmore',
    state: 'XX',
    zip: '00007',
    phone: '+1 (555) 010-0007',
    hours: 'Mon-Sun: 10am - 10pm',
    description:
      'Dunmore Crossing is our highest-volume emulator location — great for testing multi-location inventory edge cases and featured product displays.',
    coordinates: { lat: 10.007, lng: -10.007 },
    placeId: 'fixture-place-id-dunmore',
  },
  {
    slug: 'ashby',
    name: 'Ashby Flats',
    address: '9 Cypress Mock Lane',
    city: 'Ashby',
    state: 'XX',
    zip: '00008',
    phone: '+1 (555) 010-0008',
    hours: 'Tue-Sun: 10am - 8pm',
    description:
      'A boutique Rush N Relax outpost in Ashby Flats — smaller footprint, carefully curated shelves, and a staff that knows every product by name.',
    coordinates: { lat: 10.008, lng: -10.008 },
    placeId: 'fixture-place-id-ashby',
  },
  {
    slug: 'veldora',
    name: 'Veldora',
    address: '1 Stub Street',
    city: 'Veldora',
    state: 'XX',
    zip: '00009',
    phone: '+1 (555) 010-0009',
    hours: 'Mon-Sun: 9am - 11pm',
    description:
      'Extended hours and a wide floor plan make Veldora one of our most flexible test locations. Ideal for exercising late-hour availability logic.',
    coordinates: { lat: 10.009, lng: -10.009 },
    placeId: 'fixture-place-id-veldora',
  },
  {
    slug: 'graymere',
    name: 'Graymere',
    address: '77 Null Island Court',
    city: 'Graymere',
    state: 'XX',
    zip: '00010',
    phone: '+1 (555) 010-0010',
    hours: 'Mon-Sat: 10am - 7pm',
    description:
      'Our newest fixture location. Graymere covers the closed/limited-hours branch for schedule and availability tests.',
    coordinates: { lat: 10.01, lng: -10.01 },
    placeId: 'fixture-place-id-graymere',
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
  {
    slug: 'pre-roll',
    label: 'Pre-Rolls',
    description: 'Hand-rolled pre-rolls, singles and multi-packs',
    order: 6,
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
    image: 'products/flower.jpg',
    status: 'active',
    coaUrl: 'COA/Blue-Dream-2024-01.pdf',
  },
  {
    slug: 'concentrates',
    name: 'Premium Concentrates',
    category: 'concentrates',
    details:
      'For those who appreciate purity and potency, our concentrate selection sets the bar. Choose from crumble, diamonds, diamond sauce, kief, and live rosin - each lab-tested and selected for exceptional terpene retention and clean extraction. Whether you dab, top a bowl, or vaporize, these concentrates deliver a depth of flavor and effect that flower alone cannot reach.',
    image: 'products/concentrates.jpg',
    status: 'active',
    coaUrl: 'COA/OG-Kush-2024-01.pdf',
  },
  {
    slug: 'drinks',
    name: 'THCa Infused Drinks',
    category: 'drinks',
    details:
      'Skip the smoke and sip your way to elevation. Our THCa-infused beverage lineup features light, carbonated seltzers in a range of natural flavors, each precisely dosed for a consistent, predictable experience. Low-calorie, fast-acting, and sessionable - they are equally at home at a backyard gathering or a quiet night in. Explore our current flavor rotation in store.',
    image: 'products/drinks.jpg',
    status: 'active',
  },
  {
    slug: 'edibles',
    name: 'Gourmet Edibles',
    category: 'edibles',
    details:
      'Edibles are where indulgence meets intention. Our shelves carry artisan chocolates, fruit-forward gummies, rich caramel chews, and freshly inspired cookies - every piece crafted for flavor first and dosed for reliability. Start low, go slow, and savor. Whether you are new to edibles or a seasoned enthusiast, our staff will help you find the perfect treat and dosage.',
    image: 'products/edibles.jpg',
    status: 'active',
    coaUrl: 'COA/Gelato-2024-01.pdf',
  },
  {
    slug: 'vapes',
    name: 'Sleek Vape Devices',
    category: 'vapes',
    details:
      'Our curated vape collection features trusted brands like TribeToke and Wildwoods alongside a rotating selection of premium cartridges and disposables. Every device is chosen for build quality, airflow, and oil compatibility so you get a smooth, flavorful draw every time. Compact enough for your pocket, refined enough for any occasion - vaping has never looked or tasted this good.',
    image: 'products/vapes.jpg',
    status: 'active',
  },
];

/**
 * Online store inventory — canonical source for storefront variant pricing.
 * Covers the 5 generic category products (used by E2E storefront tests) plus
 * a set of real catalog products that exercise specific edge cases:
 *
 *   blue-dream            — fully priced featured flower (happy path)
 *   og-kush               — full-sale flower (compareAtPrice on every variant)
 *   granddaddy-purple     — out-of-stock (inStock: false, featured cleared)
 *   blue-dream-pre-roll   — combinable variant pricing (weight × qty cross-product)
 *   gelato-live-rosin     — partial pricing (0-5g unpriced → unorderable)
 *   wyld-raspberry-gummies — per-variant soldout (50mg: inStock: false)
 *   uncle-skunks-lemon-ginger-sparkling-water — drink with staff notes
 *   blue-dream-distillate-cart — in-store only (availableOnline: false)
 */
export const ONLINE_INVENTORY_FIXTURES: readonly InventoryItemFixture[] = [
  // ── Generic category products (E2E storefront baseline) ──────────────────────
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

  // ── Real catalog products — edge-case coverage ───────────────────────────────

  // Happy path: fully priced, featured flower from the catalog
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'blue-dream',
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: true,
    quantity: 24,
    variantPricing: {
      '1g': { price: 1200 },
      '3-5g': { price: 3200 },
      '7g': { price: 5800 },
      '14g': { price: 10500, compareAtPrice: 12000 },
      '28g': { price: 18000, compareAtPrice: 20000 },
    },
  },

  // Full-sale: compareAtPrice on every variant (entire product on sale)
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'og-kush',
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: false,
    quantity: 10,
    variantPricing: {
      '1g': { price: 900, compareAtPrice: 1100 },
      '3-5g': { price: 2500, compareAtPrice: 3000 },
      '7g': { price: 4500, compareAtPrice: 5500 },
      '14g': { price: 8000, compareAtPrice: 10000 },
      '28g': { price: 14000, compareAtPrice: 17000 },
    },
  },

  // Out-of-stock: inStock false, featured must remain false
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'granddaddy-purple',
    inStock: false,
    availableOnline: true,
    availablePickup: false,
    featured: false,
    quantity: 0,
    variantPricing: {
      '1g': { price: 1100 },
      '3-5g': { price: 3000 },
      '7g': { price: 5200 },
      '14g': { price: 9500 },
      '28g': { price: 16500 },
    },
    notes: 'Restock ETA Thursday — hold requests accepted at counter',
  },

  // Combinable variant pricing: pre-roll weight × quantity cross-product keys
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'blue-dream-pre-roll',
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: true,
    quantity: 30,
    variantPricing: {
      '0-5g-1-pack': { price: 800 },
      '0-5g-2-pack': { price: 1400 },
      '0-5g-5-pack': { price: 3200, compareAtPrice: 4000 },
      '1g-1-pack': { price: 1400 },
      '1g-2-pack': { price: 2500 },
      '1g-5-pack': { price: 6000, compareAtPrice: 7000 },
    },
  },

  // Partial pricing: 0-5g variant has no price entry → unorderable on storefront
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'gelato-live-rosin',
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: false,
    quantity: 8,
    variantPricing: {
      // '0-5g' intentionally omitted — tests "unpriced variant" UI branch
      '1g': { price: 5500, compareAtPrice: 6000 },
    },
  },

  // Per-variant soldout: 50mg is inStock: false, 25mg still orderable
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'wyld-raspberry-gummies',
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: false,
    quantity: 15,
    variantPricing: {
      '25mg': { price: 1800 },
      '50mg': { price: 3200, inStock: false },
    },
  },

  // Staff notes: drink with restock annotation
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'uncle-skunks-lemon-ginger-sparkling-water',
    inStock: true,
    availableOnline: true,
    availablePickup: false,
    featured: false,
    quantity: 48,
    variantPricing: {
      'single-can': { price: 600 },
      '2-pack': { price: 1000 },
    },
    notes: 'Last case — reorder placed',
  },

  // In-store only: availableOnline false means hidden from storefront browse
  {
    locationId: ONLINE_LOCATION_ID,
    productId: 'blue-dream-distillate-cart',
    inStock: true,
    availableOnline: false,
    availablePickup: false,
    featured: false,
    quantity: 12,
    variantPricing: {
      '0-5g-cart': { price: 2200 },
      '1g-cart': { price: 3800 },
    },
  },
];

/**
 * Retail location inventory — exercises per-location stock states and pickup availability.
 *
 *   oak-ridge   — primary test location: pickup enabled, mix of in/out-of-stock
 *   maryville   — secondary: pickup enabled, subset of products
 *   seymour     — pickup disabled for most products (no-pickup branch)
 */
export const RETAIL_INVENTORY_FIXTURES: readonly InventoryItemFixture[] = [
  // ── Oak Ridge ────────────────────────────────────────────────────────────────

  // In-stock, pickup enabled, featured at this location
  {
    locationId: 'oak-ridge',
    productId: 'blue-dream',
    inStock: true,
    availableOnline: false,
    availablePickup: true,
    featured: true,
    quantity: 18,
    variantPricing: {
      '1g': { price: 1200 },
      '3-5g': { price: 3200 },
      '7g': { price: 5800 },
      '14g': { price: 10500 },
      '28g': { price: 18000 },
    },
  },

  // In-stock, pickup enabled, not featured
  {
    locationId: 'oak-ridge',
    productId: 'og-kush',
    inStock: true,
    availableOnline: false,
    availablePickup: true,
    featured: false,
    quantity: 6,
    variantPricing: {
      '1g': { price: 1100 },
      '3-5g': { price: 3000 },
      '7g': { price: 5500 },
      '14g': { price: 10000 },
      '28g': { price: 17000 },
    },
  },

  // Out-of-stock at oak-ridge specifically (same product in stock online + maryville)
  {
    locationId: 'oak-ridge',
    productId: 'granddaddy-purple',
    inStock: false,
    availableOnline: false,
    availablePickup: false,
    featured: false,
    quantity: 0,
    notes: 'Sold out — next delivery Friday',
  },

  // In-store only vape — available for retail pickup but not online
  {
    locationId: 'oak-ridge',
    productId: 'blue-dream-distillate-cart',
    inStock: true,
    availableOnline: false,
    availablePickup: true,
    featured: false,
    quantity: 8,
    variantPricing: {
      '0-5g-cart': { price: 2200 },
      '1g-cart': { price: 3800 },
    },
  },

  // Pre-roll at retail — combinable variant keys
  {
    locationId: 'oak-ridge',
    productId: 'blue-dream-pre-roll',
    inStock: true,
    availableOnline: false,
    availablePickup: true,
    featured: false,
    quantity: 20,
    variantPricing: {
      '0-5g-1-pack': { price: 800 },
      '0-5g-5-pack': { price: 3200 },
      '1g-1-pack': { price: 1400 },
      '1g-5-pack': { price: 6000 },
    },
  },

  // ── Maryville ────────────────────────────────────────────────────────────────

  // Same flower as oak-ridge — tests multi-location same product
  {
    locationId: 'maryville',
    productId: 'blue-dream',
    inStock: true,
    availableOnline: false,
    availablePickup: true,
    featured: true,
    quantity: 14,
    variantPricing: {
      '1g': { price: 1200 },
      '3-5g': { price: 3200 },
      '7g': { price: 5800 },
      '14g': { price: 10500 },
      '28g': { price: 18000 },
    },
  },

  // Granddaddy Purple in stock at maryville, out-of-stock at oak-ridge
  {
    locationId: 'maryville',
    productId: 'granddaddy-purple',
    inStock: true,
    availableOnline: false,
    availablePickup: true,
    featured: false,
    quantity: 5,
    variantPricing: {
      '1g': { price: 1100 },
      '3-5g': { price: 3000 },
      '7g': { price: 5200 },
      '14g': { price: 9500 },
      '28g': { price: 16500 },
    },
  },

  // Concentrate at maryville only — location-exclusive product
  {
    locationId: 'maryville',
    productId: 'gelato-live-rosin',
    inStock: true,
    availableOnline: false,
    availablePickup: true,
    featured: false,
    quantity: 4,
    variantPricing: {
      '0-5g': { price: 3000 },
      '1g': { price: 5500 },
    },
  },

  // ── Seymour ──────────────────────────────────────────────────────────────────

  // Pickup disabled at Seymour — tests availablePickup: false retail branch
  {
    locationId: 'seymour',
    productId: 'og-kush',
    inStock: true,
    availableOnline: false,
    availablePickup: false,
    featured: false,
    quantity: 9,
    variantPricing: {
      '1g': { price: 1100 },
      '3-5g': { price: 3000 },
      '7g': { price: 5500 },
      '14g': { price: 10000 },
      '28g': { price: 17000 },
    },
  },

  // Edible at seymour — per-variant soldout mirrored at retail
  {
    locationId: 'seymour',
    productId: 'wyld-raspberry-gummies',
    inStock: true,
    availableOnline: false,
    availablePickup: true,
    featured: false,
    quantity: 10,
    variantPricing: {
      '25mg': { price: 1800 },
      '50mg': { price: 3200, inStock: false },
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
      'The Hitoki Trident uses three precision laser beams to ignite your flower - no butane, no torch, just pure flavor. Try it now at Rush N Relax Hartwell.',
    details:
      'The Hitoki Trident replaces your lighter or torch with three high-powered laser beams that ignite flower directly - no butane, no residue, no compromised terpenes. Compatible with standard 14mm water pipes, rechargeable via USB-C, and built for daily use. The result is a noticeably cleaner, more flavorful hit every time. Available to try at Rush N Relax Hartwell. Ask our staff for a walkthrough.',
    cta: 'Visit Hartwell',
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
      '19 Ridgeline Drive',
    ],
    active: true,
  },
];

export const LOCATION_REVIEW_FIXTURES: readonly LocationReviewFixture[] = [
  {
    placeId: 'fixture-place-id-oak-ridge',
    rating: 4.8,
    totalRatings: 312,
    reviews: [
      {
        author_name: 'Jane D.',
        rating: 5,
        text: 'Incredible selection and knowledgeable staff. Best dispensary in Pinecrest!',
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
    placeId: 'fixture-place-id-seymour',
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
    placeId: 'fixture-place-id-maryville',
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
        text: 'Best dispensary in Bluffton. Will absolutely be back.',
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
    coaUrl: product.coaUrl,
    availableAt: product.availableAt ?? [...LOCATION_SLUGS],
    createdAt: date,
    updatedAt: date,
  }));
}

function inventoryItemFromFixture(
  item: InventoryItemFixture,
  date: Date
): InventoryItem {
  const doc: InventoryItem = {
    productId: item.productId,
    locationId: item.locationId,
    inStock: item.inStock,
    availableOnline: item.availableOnline,
    availablePickup: item.availablePickup,
    featured: item.featured,
    quantity: item.quantity,
    variantPricing: item.variantPricing,
    updatedAt: date,
  };
  const notes = item.notes;
  if (notes) doc.notes = notes;
  return doc;
}

export function buildOnlineInventoryDocuments(
  date: Date = fixtureDate
): InventoryItem[] {
  return ONLINE_INVENTORY_FIXTURES.map(item =>
    inventoryItemFromFixture(item, date)
  );
}

export function buildRetailInventoryDocuments(
  date: Date = fixtureDate
): InventoryItem[] {
  return RETAIL_INVENTORY_FIXTURES.map(item =>
    inventoryItemFromFixture(item, date)
  );
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
    group: {
      groupId: 'flower',
      label: 'Weight',
      combinable: false,
      options: [
        { optionId: '1g', label: '1g' },
        { optionId: '3-5g', label: '3.5g' },
        { optionId: '7g', label: '7g' },
        { optionId: '14g', label: '14g' },
        { optionId: '28g', label: '28g' },
      ],
    },
  },
  {
    key: 'preroll-qty',
    label: 'Preroll (qty)',
    group: {
      groupId: 'preroll-qty',
      label: 'Quantity',
      combinable: false,
      options: [
        { optionId: '1-pack', label: '1-pack' },
        { optionId: '2-pack', label: '2-pack' },
        { optionId: '5-pack', label: '5-pack' },
      ],
    },
  },
  {
    key: 'preroll-weight',
    label: 'Preroll (weight)',
    group: {
      groupId: 'preroll-weight',
      label: 'Weight',
      combinable: false,
      options: [
        { optionId: '0-5g', label: '0.5g' },
        { optionId: '0-75g', label: '0.75g' },
        { optionId: '1g', label: '1g' },
        { optionId: '1-5g', label: '1.5g' },
      ],
    },
  },
  {
    key: 'concentrate',
    label: 'Concentrate',
    group: {
      groupId: 'concentrate',
      label: 'Weight',
      combinable: false,
      options: [
        { optionId: '0-5g', label: '0.5g' },
        { optionId: '1g', label: '1g' },
      ],
    },
  },
  {
    key: 'edible',
    label: 'Edible (free-form)',
    group: {
      groupId: 'edible',
      label: 'Size',
      combinable: false,
      options: [],
    },
  },
  {
    key: 'vape',
    label: 'Vape',
    group: {
      groupId: 'vape',
      label: 'Size',
      combinable: false,
      options: [
        { optionId: '0-5g-cart', label: '0.5g cart' },
        { optionId: '1g-cart', label: '1g cart' },
        { optionId: 'disposable-1g', label: 'Disposable 1g' },
      ],
    },
  },
  {
    key: 'drink',
    label: 'Drink',
    group: {
      groupId: 'drink',
      label: 'Quantity',
      combinable: false,
      options: [
        { optionId: 'single-can', label: 'Single Can' },
        { optionId: '2-pack', label: '2-pack' },
      ],
    },
  },
  {
    key: 'single',
    label: 'Single / 1-pack',
    group: {
      groupId: 'single',
      label: 'Quantity',
      combinable: false,
      options: [{ optionId: '1-pack', label: '1-pack' }],
    },
  },
  {
    key: 'custom',
    label: 'Custom',
    group: {
      groupId: 'custom',
      label: 'Option',
      combinable: false,
      options: [],
    },
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

const CATEGORY_CONTRACT_FLAGS: Record<
  string,
  {
    requiresCannabisProfile: boolean;
    requiresNutritionFacts: boolean;
    requiresCOA: boolean;
  }
> = {
  flower: {
    requiresCannabisProfile: true,
    requiresNutritionFacts: false,
    requiresCOA: true,
  },
  concentrates: {
    requiresCannabisProfile: true,
    requiresNutritionFacts: false,
    requiresCOA: true,
  },
  'pre-roll': {
    requiresCannabisProfile: true,
    requiresNutritionFacts: false,
    requiresCOA: true,
  },
  vapes: {
    requiresCannabisProfile: false,
    requiresNutritionFacts: false,
    requiresCOA: true,
  },
  edibles: {
    requiresCannabisProfile: false,
    requiresNutritionFacts: true,
    requiresCOA: false,
  },
  drinks: {
    requiresCannabisProfile: false,
    requiresNutritionFacts: true,
    requiresCOA: false,
  },
};

export function buildCategoryDocuments(
  date: Date = fixtureDate
): ProductCategoryConfig[] {
  return CATEGORY_FIXTURES.map(cat => ({
    slug: cat.slug,
    label: cat.label,
    description: cat.description,
    order: cat.order,
    isActive: cat.isActive,
    ...(CATEGORY_CONTRACT_FLAGS[cat.slug] ?? {
      requiresCannabisProfile: false,
      requiresNutritionFacts: false,
      requiresCOA: false,
    }),
    createdAt: date,
    updatedAt: date,
  }));
}
