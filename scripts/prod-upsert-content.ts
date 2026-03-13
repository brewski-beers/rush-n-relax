/* eslint-disable no-console */
import {
  initializeApp,
  cert,
  getApps,
  type ServiceAccount,
} from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOCATIONS = [
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
    placeId: 'ChIJG2IBn08zXIgROk6xAd9qyY0',
    coordinates: { lat: 36.023978, lng: -84.24072 },
    socialLinkIds: ['fb_oak_ridge'],
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
    placeId: 'ChIJHZao5_GfXogR9G9vWnFH3IM',
    coordinates: { lat: 35.750658, lng: -83.992662 },
    socialLinkIds: ['fb_maryville'],
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
    placeId: 'ChIJb1IipsQbXIgREaNxkmmAaHg',
    coordinates: { lat: 35.861584, lng: -83.770727 },
    socialLinkIds: ['fb_seymour'],
  },
] as const;

const PRODUCTS = [
  {
    slug: 'flower',
    name: 'Premium Flower',
    category: 'flower',
    description:
      'Hand-selected THCa flower - rich terpene profiles, dense buds, and the full-spectrum experience discerning enthusiasts demand.',
    details:
      'Our flower collection is the cornerstone of the Rush N Relax experience. Every strain is hand-selected for potency, aroma, and bag appeal. From earthy indicas that melt away the day to energizing sativas that spark creativity, we carry a rotating lineup of top-shelf cultivars. Ask our staff about current strains, terpene profiles, and what pairs best with your mood.',
    image: 'products/flower.png',
    featured: true,
  },
  {
    slug: 'concentrates',
    name: 'Premium Concentrates',
    category: 'concentrates',
    description:
      'Refined, potent extracts - crumble, diamonds, live rosin, and more - delivering bold flavor and elevated intensity for the true connoisseur.',
    details:
      'For those who appreciate purity and potency, our concentrate selection sets the bar. Choose from crumble, diamonds, diamond sauce, kief, and live rosin - each lab-tested and selected for exceptional terpene retention and clean extraction. Whether you dab, top a bowl, or vaporize, these concentrates deliver a depth of flavor and effect that flower alone cannot reach.',
    image: 'products/concentrates.png',
    featured: true,
  },
  {
    slug: 'drinks',
    name: 'THCa Infused Drinks',
    category: 'drinks',
    description:
      'Crisp, refreshing THCa-infused seltzers and beverages - a clean, balanced elevation with every sip.',
    details:
      'Skip the smoke and sip your way to elevation. Our THCa-infused beverage lineup features light, carbonated seltzers in a range of natural flavors, each precisely dosed for a consistent, predictable experience. Low-calorie, fast-acting, and sessionable - they are equally at home at a backyard gathering or a quiet night in. Explore our current flavor rotation in store.',
    image: 'products/drinks.png',
    featured: true,
  },
  {
    slug: 'edibles',
    name: 'Gourmet Edibles',
    category: 'edibles',
    description:
      'Artisan chocolates, gummies, caramel chews, cookies, and confections that marry luxury taste with precisely dosed effects.',
    details:
      'Edibles are where indulgence meets intention. Our shelves carry artisan chocolates, fruit-forward gummies, rich caramel chews, and freshly inspired cookies - every piece crafted for flavor first and dosed for reliability. Start low, go slow, and savor. Whether you are new to edibles or a seasoned enthusiast, our staff will help you find the perfect treat and dosage.',
    image: 'products/edibles.png',
    featured: true,
  },
  {
    slug: 'vapes',
    name: 'Sleek Vape Devices',
    category: 'vapes',
    description:
      'Discreet, sophisticated hardware and premium oil cartridges - smooth draws, clean vapor, and effortless portability.',
    details:
      'Our curated vape collection features trusted brands like TribeToke and Wildwoods alongside a rotating selection of premium cartridges and disposables. Every device is chosen for build quality, airflow, and oil compatibility so you get a smooth, flavorful draw every time. Compact enough for your pocket, refined enough for any occasion - vaping has never looked or tasted this good.',
    image: 'products/vapes.png',
    featured: true,
  },
] as const;

const PROMOS = [
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
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseServiceAccount(json: string): ServiceAccount {
  const parsed: unknown = JSON.parse(json);

  if (!isRecord(parsed)) {
    throw new Error('Invalid serviceAccountKey.json payload.');
  }

  const projectId = parsed.project_id;
  const privateKey = parsed.private_key;
  const clientEmail = parsed.client_email;

  if (
    typeof projectId !== 'string' ||
    typeof privateKey !== 'string' ||
    typeof clientEmail !== 'string'
  ) {
    throw new Error('serviceAccountKey.json is missing required credentials.');
  }

  return {
    projectId,
    privateKey,
    clientEmail,
  };
}

const projectId = process.env.FIREBASE_PROJECT_ID || 'rush-n-relax';
const keyPath = resolve('./serviceAccountKey.json');
const serviceAccount = parseServiceAccount(readFileSync(keyPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId,
  });
}

const db = getFirestore();
const now = FieldValue.serverTimestamp();

const federalDeadlineRiskBySlug: Record<string, boolean> = {
  flower: true,
  concentrates: true,
  drinks: true,
  edibles: true,
  vapes: false,
};

async function upsertLocations(): Promise<number> {
  let written = 0;

  for (const loc of LOCATIONS) {
    await db
      .collection('locations')
      .doc(loc.slug)
      .set(
        {
          slug: loc.slug,
          name: loc.name,
          address: loc.address,
          city: loc.city,
          state: loc.state,
          zip: loc.zip,
          phone: loc.phone,
          hours: loc.hours,
          description: loc.description,
          placeId: loc.placeId,
          ...(loc.coordinates ? { coordinates: loc.coordinates } : {}),
          ...(loc.socialLinkIds ? { socialLinkIds: loc.socialLinkIds } : {}),
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

    written += 1;
  }

  return written;
}

async function upsertProducts(): Promise<number> {
  let written = 0;
  const availableAt = LOCATIONS.map(loc => loc.slug);

  for (const product of PRODUCTS) {
    await db
      .collection('products')
      .doc(product.slug)
      .set(
        {
          slug: product.slug,
          name: product.name,
          category: product.category,
          description: product.description,
          details: product.details,
          image: product.image,
          featured: Boolean(product.featured),
          status: 'active',
          federalDeadlineRisk: federalDeadlineRiskBySlug[product.slug] ?? false,
          availableAt,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

    written += 1;
  }

  return written;
}

async function upsertPromos(): Promise<number> {
  let written = 0;

  for (const promo of PROMOS) {
    await db
      .collection('promos')
      .doc(promo.slug)
      .set(
        {
          promoId: promo.promoId,
          slug: promo.slug,
          name: promo.name,
          tagline: promo.tagline,
          description: promo.description,
          details: promo.details,
          cta: promo.cta,
          ctaPath: promo.ctaPath,
          active: Boolean(promo.active),
          ...(promo.image ? { image: promo.image } : {}),
          ...(promo.locationSlug ? { locationSlug: promo.locationSlug } : {}),
          ...(promo.keywords ? { keywords: promo.keywords } : {}),
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

    written += 1;
  }

  return written;
}

async function main(): Promise<void> {
  console.log('[prod-upsert-content] Starting upsert...');
  console.log(`[prod-upsert-content] Project: ${projectId}`);

  const [locations, products, promos] = await Promise.all([
    upsertLocations(),
    upsertProducts(),
    upsertPromos(),
  ]);

  console.log(
    `[prod-upsert-content] Done: locations=${locations}, products=${products}, promos=${promos}`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[prod-upsert-content] Failed: ${message}`);
  process.exitCode = 1;
});
