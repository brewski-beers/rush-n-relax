/**
 * Seed Firestore from existing TypeScript constants.
 * Run once to populate the Firestore emulator (or production) from the
 * hardcoded data in src/constants/.
 *
 * Usage (emulator):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-from-constants.ts
 *
 * Usage (production — requires service account):
 *   FIREBASE_SERVICE_ACCOUNT_JSON=$(cat service-account.json) npx tsx scripts/seed-from-constants.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// ── Constants (copied types, not imported, to avoid Vite-specific imports) ──

const LOCATIONS_DATA = [
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
      'Home to our signature speakeasy-style lounge and full-service dispensary. Step inside for handpicked flower, concentrates, edibles, and vapes — complemented by a refined lounge where you can settle in, unwind, and enjoy the experience the way it was meant to be.',
    coordinates: { lat: 36.023978, lng: -84.24072 },
    placeId: 'ChIJG2IBn08zXIgROk6xAd9qyY0',
    socialLinkIds: ['facebook_oak_ridge'],
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
      'Situated along Watkins Road in the heart of Blount County, our Maryville dispensary brings a refined retail experience to the foothills of the Smokies. Walk in for expertly curated flower, edibles, concentrates, and vapes — all held to the same exacting standard that defines Rush N Relax.',
    coordinates: { lat: 35.750658, lng: -83.992662 },
    placeId: 'ChIJHZao5_GfXogR9G9vWnFH3IM',
    socialLinkIds: ['facebook_maryville'],
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
      'Nestled along Maryville Highway between Knoxville and the Smokies, our Seymour location offers a relaxed, welcoming atmosphere with the same premium selection you expect from Rush N Relax. Swing by on your way through Sevier County — we make it easy to find exactly what you need.',
    coordinates: { lat: 35.861584, lng: -83.770727 },
    placeId: 'ChIJb1IipsQbXIgREaNxkmmAaHg',
    socialLinkIds: ['facebook_seymour'],
  },
];

const PRODUCTS_DATA = [
  {
    slug: 'flower',
    name: 'Premium Flower',
    category: 'flower',
    description:
      'Hand-selected THCa flower — rich terpene profiles, dense buds, and the full-spectrum experience discerning enthusiasts demand.',
    details:
      'Our flower collection is the cornerstone of the Rush N Relax experience. Every strain is hand-selected for potency, aroma, and bag appeal. From earthy indicas that melt away the day to energizing sativas that spark creativity, we carry a rotating lineup of top-shelf cultivars. Ask our staff about current strains, terpene profiles, and what pairs best with your mood.',
    image: 'products/flower.png',
    featured: true,
    status: 'active',
    federalDeadlineRisk: true,
    shippableCategories: ['hemp_flower'],
  },
  {
    slug: 'concentrates',
    name: 'Premium Concentrates',
    category: 'concentrates',
    description:
      'Refined, potent extracts — crumble, diamonds, live rosin, and more — delivering bold flavor and elevated intensity for the true connoisseur.',
    details:
      'For those who appreciate purity and potency, our concentrate selection sets the bar. Choose from crumble, diamonds, diamond sauce, kief, and live rosin — each lab-tested and selected for exceptional terpene retention and clean extraction. Whether you dab, top a bowl, or vaporize, these concentrates deliver a depth of flavor and effect that flower alone cannot reach.',
    image: 'products/concentrates.png',
    featured: true,
    status: 'active',
    federalDeadlineRisk: true,
    shippableCategories: [],
  },
  {
    slug: 'drinks',
    name: 'THCa Infused Drinks',
    category: 'drinks',
    description:
      'Crisp, refreshing THCa-infused seltzers and beverages — a clean, balanced elevation with every sip.',
    details:
      'Skip the smoke and sip your way to elevation. Our THCa-infused beverage lineup features light, carbonated seltzers in a range of natural flavors, each precisely dosed for a consistent, predictable experience. Low-calorie, fast-acting, and sessionable — they are equally at home at a backyard gathering or a quiet night in. Explore our current flavor rotation in store.',
    image: 'products/drinks.png',
    featured: true,
    status: 'active',
    federalDeadlineRisk: true,
    shippableCategories: [],
  },
  {
    slug: 'edibles',
    name: 'Gourmet Edibles',
    category: 'edibles',
    description:
      'Artisan chocolates, gummies, caramel chews, cookies, and confections that marry luxury taste with precisely dosed effects.',
    details:
      'Edibles are where indulgence meets intention. Our shelves carry artisan chocolates, fruit-forward gummies, rich caramel chews, and freshly inspired cookies — every piece crafted for flavor first and dosed for reliability. Start low, go slow, and savor. Whether you are new to edibles or a seasoned enthusiast, our staff will help you find the perfect treat and dosage.',
    image: 'products/edibles.png',
    featured: true,
    status: 'active',
    federalDeadlineRisk: true,
    shippableCategories: [],
  },
  {
    slug: 'vapes',
    name: 'Sleek Vape Devices',
    category: 'vapes',
    description:
      'Discreet, sophisticated hardware and premium oil cartridges — smooth draws, clean vapor, and effortless portability.',
    details:
      'Our curated vape collection features trusted brands like TribeToke and Wildwoods alongside a rotating selection of premium cartridges and disposables. Every device is chosen for build quality, airflow, and oil compatibility so you get a smooth, flavorful draw every time. Compact enough for your pocket, refined enough for any occasion — vaping has never looked or tasted this good.',
    image: 'products/vapes.png',
    featured: true,
    status: 'active',
    federalDeadlineRisk: false,
    shippableCategories: [],
  },
];

const PROMOS_DATA = [
  {
    promoId: 'hitoki-laser-bong-2025',
    slug: 'laser-bong',
    name: 'Hitoki Laser Bong',
    tagline: 'Laser Bong — Google It.',
    description:
      "The Hitoki Serquet is the world's first laser-powered bong — combustion replaced by a precision laser for the cleanest, smoothest hit you've ever taken. Try it now at Rush N Relax Seymour, 500 Maryville Hwy.",
    details:
      'The Hitoki Serquet uses a high-powered laser instead of a flame, delivering a hit free of butane or torch residue. The result is pure, clean vapor straight from the flower — no combustion byproducts, no harshness, just the full terpene profile of whatever you load. Available to try at Rush N Relax Seymour — 500 Maryville Hwy, Suite 205. Ask our staff for a walkthrough.',
    cta: 'Visit Seymour',
    ctaPath: '/locations/seymour',
    image: 'promos/laser-bong.png',
    locationSlug: 'seymour',
    keywords: [
      'Hitoki Serquet',
      'laser bong',
      'laser powered bong',
      '500 Maryville Hwy',
    ],
    active: true,
  },
];

// ── Init ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'rnr';

function initAdmin() {
  if (getApps().length > 0) return;

  const useEmulator =
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

  if (useEmulator) {
    initializeApp({ projectId: 'rush-n-relax' });
  } else {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON is required for production seeding.'
      );
    }
    initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
  }
}

// ── Seeding helpers ───────────────────────────────────────────────────────

async function seedCollection<T extends { slug: string }>(
  collectionPath: string,
  items: T[],
  label: string
) {
  const db = getFirestore();
  const col = db.collection(collectionPath);

  for (const item of items) {
    const now = Timestamp.now();
    // Use slug as document ID for stable, human-readable references
    await col.doc(item.slug).set({
      ...item,
      tenantId: TENANT_ID,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  ✓ ${label}: ${item.slug}`);
  }
}

async function seedPromosWithPromoId() {
  const db = getFirestore();
  const col = db.collection(`tenants/${TENANT_ID}/promos`);

  for (const promo of PROMOS_DATA) {
    const now = Timestamp.now();
    await col.doc(promo.slug).set({
      ...promo,
      tenantId: TENANT_ID,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  ✓ promo: ${promo.slug}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding Firestore from constants...');
  console.log(`Tenant: ${TENANT_ID}`);

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulatorHost) {
    console.log(`Emulator: ${emulatorHost}`);
  } else {
    console.log('Target: PRODUCTION — proceed with caution');
  }

  initAdmin();

  console.log('\nSeeding locations...');
  await seedCollection(
    `tenants/${TENANT_ID}/locations`,
    LOCATIONS_DATA,
    'location'
  );

  console.log('\nSeeding products...');
  await seedCollection(
    `tenants/${TENANT_ID}/products`,
    PRODUCTS_DATA,
    'product'
  );

  console.log('\nSeeding promos...');
  await seedPromosWithPromoId();

  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
