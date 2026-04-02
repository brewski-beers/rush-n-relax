// Run with: npx tsx scripts/seed-vendors.ts
// Seeds the vendors collection into the Firebase emulator.
// Expects Firestore emulator on :8080.

import { getAdminFirestore } from '../src/lib/firebase/admin';
import type { Vendor } from '../src/types';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const vendors: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    slug: 'secret-nature',
    name: 'Secret Nature',
    website: 'https://secretnaturecbd.com',
    descriptionSource: 'leafly',
    isActive: true,
  },
  {
    slug: 'plain-jane',
    name: 'Plain Jane',
    website: 'https://plainjane.com',
    descriptionSource: 'leafly',
    isActive: true,
  },
  {
    slug: 'cbdfx',
    name: 'CBDfx',
    website: 'https://cbdfx.com',
    descriptionSource: 'vendor-provided',
    isActive: true,
  },
  {
    slug: 'cannaaid',
    name: 'CannaAid',
    website: 'https://cannaaidshop.com',
    descriptionSource: 'custom',
    isActive: true,
  },
  {
    slug: 'exhale-wellness',
    name: 'Exhale Wellness',
    website: 'https://exhalewellness.com',
    descriptionSource: 'vendor-provided',
    isActive: true,
  },
  {
    slug: 'delta-extrax',
    name: 'Delta Extrax',
    website: 'https://deltaextrax.com',
    descriptionSource: 'vendor-provided',
    isActive: true,
  },
];

async function seedVendors() {
  const db = getAdminFirestore();
  const col = db.collection('vendors');
  const now = new Date();

  for (const vendor of vendors) {
    const docRef = col.doc(vendor.slug);
    const existing = await docRef.get();

    if (existing.exists) {
      await docRef.update({ ...vendor, updatedAt: now });
      console.log(`  updated: vendors/${vendor.slug}`);
    } else {
      await docRef.set({ ...vendor, createdAt: now, updatedAt: now });
      console.log(`  created: vendors/${vendor.slug}`);
    }
  }

  console.log(`\nSeeded ${vendors.length} vendors.`);
}

seedVendors().catch(err => {
  console.error(err);
  process.exit(1);
});
