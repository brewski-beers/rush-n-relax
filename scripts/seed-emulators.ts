// Run with: npx tsx scripts/seed-emulators.ts
// Seeds the Firebase emulators with deterministic data for E2E tests.
// Expects Firestore emulator on :8080 and Storage emulator on :9199.
//
// Promos are imported from src/constants/promos.ts — the single source of truth.
// Locations and products are inlined here (they're stable; update src/constants/ first,
// then mirror here if the data ever changes).

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PROMOS } from '../src/constants/promos';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIRESTORE_BASE = 'http://localhost:8080';
const STORAGE_BASE = 'http://localhost:9199';
const PROJECT = 'rush-n-relax';
const STORAGE_BUCKET = 'rush-n-relax.firebasestorage.app';
const EMULATOR_AUTH = { Authorization: 'Bearer owner' };

// ── HTTP helper ────────────────────────────────────────────────────────────────

function request(
  options: http.RequestOptions,
  body?: Buffer | string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve({ status: res.statusCode ?? 0, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Firestore helpers ──────────────────────────────────────────────────────────

async function clearFirestore() {
  const url = new URL(
    `/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    FIRESTORE_BASE
  );
  await request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'DELETE',
  });
  console.log('✓ Firestore cleared');
}

type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

type FirestoreFields = Record<string, FirestoreValue>;

async function seedFirestoreDoc(
  collection: string,
  docId: string,
  fields: FirestoreFields
) {
  const body = JSON.stringify({ fields });
  const url = new URL(
    `/v1/projects/${PROJECT}/databases/(default)/documents/${collection}/${docId}`,
    FIRESTORE_BASE
  );
  await request(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'PATCH',
      headers: {
        ...EMULATOR_AUTH,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body
  );
  console.log(`✓ Firestore seeded: ${collection}/${docId}`);
}

const now = () => ({ timestampValue: new Date().toISOString() });
const str = (v: string): FirestoreValue => ({ stringValue: v });
const bool = (v: boolean): FirestoreValue => ({ booleanValue: v });
const strArray = (arr: string[]): FirestoreValue => ({
  arrayValue: { values: arr.map(s => ({ stringValue: s })) },
});

// ── Locations ─────────────────────────────────────────────────────────────────
// Source of truth: src/constants/locations.ts — mirror any changes here.

const ALL_LOCATION_SLUGS = ['oak-ridge', 'maryville', 'seymour'];

async function seedLocations() {
  const locations = [
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
        'Situated along Watkins Road in the heart of Blount County, our Maryville dispensary brings a refined retail experience to the foothills of the Smokies. Walk in for expertly curated flower, edibles, concentrates, and vapes — all held to the same exacting standard that defines Rush N Relax.',
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
        'Nestled along Maryville Highway between Knoxville and the Smokies, our Seymour location offers a relaxed, welcoming atmosphere with the same premium selection you expect from Rush N Relax. Swing by on your way through Sevier County — we make it easy to find exactly what you need.',
      placeId: 'ChIJb1IipsQbXIgREaNxkmmAaHg',
      coordinates: { lat: 35.861584, lng: -83.770727 },
      socialLinkIds: ['fb_seymour'],
    },
  ];

  for (const loc of locations) {
    await seedFirestoreDoc('locations', loc.slug, {
      slug: str(loc.slug),
      name: str(loc.name),
      address: str(loc.address),
      city: str(loc.city),
      state: str(loc.state),
      zip: str(loc.zip),
      phone: str(loc.phone),
      hours: str(loc.hours),
      description: str(loc.description),
      placeId: str(loc.placeId),
      coordinates: {
        mapValue: {
          fields: {
            lat: { doubleValue: loc.coordinates.lat },
            lng: { doubleValue: loc.coordinates.lng },
          },
        },
      },
      socialLinkIds: strArray(loc.socialLinkIds),
      createdAt: now(),
      updatedAt: now(),
    });
  }
}

// ── Products ──────────────────────────────────────────────────────────────────
// Source of truth: src/constants/products.ts — mirror any changes here.

async function seedProducts() {
  const availableAt = strArray(ALL_LOCATION_SLUGS);

  const products = [
    {
      slug: 'flower',
      name: 'Premium Flower',
      category: 'flower',
      description:
        'Hand-selected THCa flower — rich terpene profiles, dense buds, and the full-spectrum experience discerning enthusiasts demand.',
      details:
        'Our flower collection is the cornerstone of the Rush N Relax experience. Every strain is hand-selected for potency, aroma, and bag appeal. From earthy indicas that melt away the day to energizing sativas that spark creativity, we carry a rotating lineup of top-shelf cultivars. Ask our staff about current strains, terpene profiles, and what pairs best with your mood.',
      featured: true,
      federalDeadlineRisk: true,
    },
    {
      slug: 'concentrates',
      name: 'Premium Concentrates',
      category: 'concentrates',
      description:
        'Refined, potent extracts — crumble, diamonds, live rosin, and more — delivering bold flavor and elevated intensity for the true connoisseur.',
      details:
        'For those who appreciate purity and potency, our concentrate selection sets the bar. Choose from crumble, diamonds, diamond sauce, kief, and live rosin — each lab-tested and selected for exceptional terpene retention and clean extraction. Whether you dab, top a bowl, or vaporize, these concentrates deliver a depth of flavor and effect that flower alone cannot reach.',
      featured: true,
      federalDeadlineRisk: true,
    },
    {
      slug: 'drinks',
      name: 'THCa Infused Drinks',
      category: 'drinks',
      description:
        'Crisp, refreshing THCa-infused seltzers and beverages — a clean, balanced elevation with every sip.',
      details:
        'Skip the smoke and sip your way to elevation. Our THCa-infused beverage lineup features light, carbonated seltzers in a range of natural flavors, each precisely dosed for a consistent, predictable experience. Low-calorie, fast-acting, and sessionable — they are equally at home at a backyard gathering or a quiet night in. Explore our current flavor rotation in store.',
      featured: true,
      federalDeadlineRisk: true,
    },
    {
      slug: 'edibles',
      name: 'Gourmet Edibles',
      category: 'edibles',
      description:
        'Artisan chocolates, gummies, caramel chews, cookies, and confections that marry luxury taste with precisely dosed effects.',
      details:
        'Edibles are where indulgence meets intention. Our shelves carry artisan chocolates, fruit-forward gummies, rich caramel chews, and freshly inspired cookies — every piece crafted for flavor first and dosed for reliability. Start low, go slow, and savor. Whether you are new to edibles or a seasoned enthusiast, our staff will help you find the perfect treat and dosage.',
      featured: true,
      federalDeadlineRisk: true,
    },
    {
      slug: 'vapes',
      name: 'Sleek Vape Devices',
      category: 'vapes',
      description:
        'Discreet, sophisticated hardware and premium oil cartridges — smooth draws, clean vapor, and effortless portability.',
      details:
        'Our curated vape collection features trusted brands like TribeToke and Wildwoods alongside a rotating selection of premium cartridges and disposables. Every device is chosen for build quality, airflow, and oil compatibility so you get a smooth, flavorful draw every time. Compact enough for your pocket, refined enough for any occasion — vaping has never looked or tasted this good.',
      featured: true,
      federalDeadlineRisk: false,
    },
  ];

  for (const p of products) {
    await seedFirestoreDoc('products', p.slug, {
      slug: str(p.slug),
      name: str(p.name),
      category: str(p.category),
      description: str(p.description),
      details: str(p.details),
      image: str(`products/${p.slug}.png`),
      featured: bool(p.featured),
      status: str('active'),
      federalDeadlineRisk: bool(p.federalDeadlineRisk),
      availableAt,
      createdAt: now(),
      updatedAt: now(),
    });
  }
}

// ── Promos ────────────────────────────────────────────────────────────────────
// Imported from src/constants/promos.ts — the single source of truth.

async function seedPromos() {
  for (const promo of PROMOS) {
    const fields: FirestoreFields = {
      promoId: str(promo.promoId),
      slug: str(promo.slug),
      name: str(promo.name),
      tagline: str(promo.tagline),
      description: str(promo.description),
      details: str(promo.details),
      cta: str(promo.cta),
      ctaPath: str(promo.ctaPath),
      active: bool(promo.active),
      createdAt: now(),
      updatedAt: now(),
    };
    if (promo.image) fields.image = str(promo.image);
    if (promo.locationSlug) fields.locationSlug = str(promo.locationSlug);
    if (promo.keywords) fields.keywords = strArray(promo.keywords);

    await seedFirestoreDoc('promos', promo.slug, fields);
  }
}

// ── Location reviews (test fixtures) ──────────────────────────────────────────

async function seedLocationReviews() {
  type ReviewTuple = [string, string, string, number];

  const makeReview = ([
    author_name,
    text,
    relative_time_description,
    time,
  ]: ReviewTuple): FirestoreValue => ({
    mapValue: {
      fields: {
        author_name: str(author_name),
        rating: { integerValue: '5' },
        text: str(text),
        relative_time_description: str(relative_time_description),
        profile_photo_url: str(''),
        time: { integerValue: String(time) },
      },
    },
  });

  const makeReviews = (rows: ReviewTuple[]): FirestoreValue => ({
    arrayValue: { values: rows.map(makeReview) },
  });

  const oakRidgePlaceId = 'ChIJG2IBn08zXIgROk6xAd9qyY0';
  await seedFirestoreDoc('location-reviews', oakRidgePlaceId, {
    placeId: str(oakRidgePlaceId),
    rating: { doubleValue: 4.8 },
    totalRatings: { integerValue: '312' },
    reviews: makeReviews([
      [
        'Jane D.',
        'Incredible selection and knowledgeable staff. Best dispensary in Oak Ridge!',
        '2 days ago',
        1700900000,
      ],
      [
        'Marcus H.',
        'My go-to spot. Always clean, always friendly. Highly recommend!',
        '1 week ago',
        1700400000,
      ],
      [
        'Patricia L.',
        'Top notch products and amazing service every single time.',
        '2 weeks ago',
        1699800000,
      ],
      [
        'Ryan K.',
        'Staff really knows their stuff. Made great recommendations for my needs.',
        '3 weeks ago',
        1699200000,
      ],
      [
        'Sandra W.',
        'Love this place. Great atmosphere and unbeatable prices.',
        '1 month ago',
        1698600000,
      ],
    ]),
    cachedAt: { integerValue: String(Date.now()) },
  });

  const seymourPlaceId = 'ChIJb1IipsQbXIgREaNxkmmAaHg';
  await seedFirestoreDoc('location-reviews', seymourPlaceId, {
    placeId: str(seymourPlaceId),
    rating: { doubleValue: 4.7 },
    totalRatings: { integerValue: '198' },
    reviews: makeReviews([
      [
        'Mark T.',
        'Friendly staff, great selection. Worth the drive every time!',
        '3 days ago',
        1700800000,
      ],
      [
        'Angela R.',
        "Best experience I've had at any dispensary. Super knowledgeable team.",
        '5 days ago',
        1700700000,
      ],
      [
        'Derek S.',
        'Always stocked with quality products. My favorite location.',
        '1 week ago',
        1700300000,
      ],
      [
        'Karen M.',
        'So professional and welcoming. Five stars every visit.',
        '2 weeks ago',
        1699700000,
      ],
      [
        'Tony B.',
        'Great deals and even better service. Highly recommended!',
        '3 weeks ago',
        1699100000,
      ],
    ]),
    cachedAt: { integerValue: String(Date.now()) },
  });

  const maryvillePlaceId = 'ChIJHZao5_GfXogR9G9vWnFH3IM';
  await seedFirestoreDoc('location-reviews', maryvillePlaceId, {
    placeId: str(maryvillePlaceId),
    rating: { doubleValue: 4.9 },
    totalRatings: { integerValue: '54' },
    reviews: makeReviews([
      [
        'Laura M.',
        'Absolutely love this location. Staff is friendly and very knowledgeable.',
        '1 day ago',
        1700950000,
      ],
      [
        'Chris B.',
        'Great atmosphere and top-shelf products. My new favorite spot.',
        '4 days ago',
        1700750000,
      ],
      [
        'Tammy R.',
        'Always a pleasure. Clean store, great selection, helpful team.',
        '1 week ago',
        1700350000,
      ],
      [
        'James H.',
        'Came in not knowing what I wanted and left perfectly taken care of.',
        '2 weeks ago',
        1699750000,
      ],
      [
        'Nicole K.',
        'Best dispensary in Blount County. Will absolutely be back.',
        '3 weeks ago',
        1699150000,
      ],
    ]),
    cachedAt: { integerValue: String(Date.now()) },
  });
}

// ── Storage stubs ──────────────────────────────────────────────────────────────

async function seedStorageStub() {
  // Minimal valid MP4 stub (ftyp + mdat boxes). URL resolves; playback not required for tests.
  const mp4Stub = Buffer.from(
    '0000002066747970' +
      '6d703432' +
      '00000000' +
      '6d703432' +
      '69736f6d' +
      '00000008' +
      '6d646174',
    'hex'
  );

  // Valid 1x1 transparent PNG for product/logo placeholders.
  const pngStub = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5R8f0AAAAASUVORK5CYII=',
    'base64'
  );

  const uploadObject = async (
    objectPath: string,
    contentType: string,
    bytes: Buffer
  ) => {
    const uploadPath = `/v0/b/${STORAGE_BUCKET}/o?name=${encodeURIComponent(objectPath)}&uploadType=media`;
    const uploadUrl = new URL(uploadPath, STORAGE_BASE);
    await request(
      {
        hostname: uploadUrl.hostname,
        port: uploadUrl.port,
        path: uploadUrl.pathname + uploadUrl.search,
        method: 'POST',
        headers: {
          ...EMULATOR_AUTH,
          'Content-Type': contentType,
          'Content-Length': bytes.length,
        },
      },
      bytes
    );
    console.log(`✓ Storage seeded: ${objectPath}`);
  };

  await uploadObject('ambient/smoke-4k.mp4', 'video/mp4', mp4Stub);
  await uploadObject('ambient/smoke-1080p.mp4', 'video/mp4', mp4Stub);

  const primaryLogoPath = path.join(
    __dirname,
    '..',
    'public',
    'icons',
    'logo-primary.png'
  );
  const primaryLogoBytes = fs.existsSync(primaryLogoPath)
    ? fs.readFileSync(primaryLogoPath)
    : pngStub;
  await uploadObject(
    'branding/logo-primary.png',
    'image/png',
    primaryLogoBytes
  );
  await uploadObject('branding/logo-accent-blue-bg.png', 'image/png', pngStub);

  for (const slug of ['flower', 'concentrates', 'drinks', 'edibles', 'vapes']) {
    await uploadObject(`products/${slug}.png`, 'image/png', pngStub);
  }

  const laserBongPath = path.join(
    __dirname,
    'assets',
    'promos',
    'laser-bong.png'
  );
  const laserBongBytes = fs.existsSync(laserBongPath)
    ? fs.readFileSync(laserBongPath)
    : pngStub;
  await uploadObject('promos/laser-bong.png', 'image/png', laserBongBytes);
}

// ── Entry point ────────────────────────────────────────────────────────────────

// ── Admin users ───────────────────────────────────────────────────────────────
// Seed a test superadmin so edit forms work in local dev.
// UID must match a Firebase Auth emulator user — create one via the emulator UI
// at localhost:4000 or with: firebase auth:import (emulator only).
// Production: create the users/{uid} doc manually in Firestore Console.

async function seedAdminUsers() {
  await seedFirestoreDoc('users', 'dev-superadmin-uid', {
    email: str('admin@rushnrelax.com'),
    displayName: str('Dev Admin'),
    role: str('superadmin'),
    locationIds: strArray([]),
    createdAt: now(),
    updatedAt: now(),
  });
}

async function run() {
  console.log('Seeding Firebase emulators...');
  await clearFirestore();
  await seedLocations();
  await seedProducts();
  await seedPromos();
  await seedLocationReviews();
  await seedAdminUsers();
  await seedStorageStub();
  console.log('\nEmulator seed complete ✓');
}

run().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
