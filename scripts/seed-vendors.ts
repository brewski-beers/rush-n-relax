// Run with: npx tsx scripts/seed-vendors.ts
// Seeds vendor documents into the Firebase emulator.
// Expects Firestore emulator on :8080.

import { upsertVendor } from '../src/lib/repositories/vendor.repository';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const vendors: Parameters<typeof upsertVendor>[0][] = [
  {
    slug: 'cbdistillery',
    name: 'CBDistillery',
    website: 'https://www.thecbdistillery.com',
    descriptionSource: 'leafly',
    notes: 'Popular national brand; descriptions sourced from Leafly.',
    isActive: true,
  },
  {
    slug: 'urb',
    name: 'URB',
    website: 'https://urb.com',
    descriptionSource: 'leafly',
    notes: 'Delta-8 and hemp-derived products.',
    isActive: true,
  },
  {
    slug: 'delta-extrax',
    name: 'Delta Extrax',
    website: 'https://deltaextrax.com',
    descriptionSource: 'vendor-provided',
    isActive: true,
  },
  {
    slug: 'koi',
    name: 'Koi CBD',
    website: 'https://koicbd.com',
    descriptionSource: 'leafly',
    isActive: true,
  },
  {
    slug: 'cake',
    name: 'Cake',
    descriptionSource: 'custom',
    notes: 'Use custom descriptions for Cake products.',
    isActive: true,
  },
  {
    slug: 'flying-monkey',
    name: 'Flying Monkey',
    website: 'https://flyingmonkeydelta8.com',
    descriptionSource: 'vendor-provided',
    isActive: true,
  },
];

async function run() {
  console.log(`Seeding ${vendors.length} vendors…`);
  for (const vendor of vendors) {
    await upsertVendor(vendor);
    console.log(`  ✓ ${vendor.slug}`);
  }
  console.log('Done.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
