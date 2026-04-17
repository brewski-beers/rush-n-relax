// Run with: npx tsx scripts/seed-vendors.ts
// Seeds the vendors collection into the Firebase emulator.
// Expects Firestore emulator on :8080.
// Idempotent: updates existing docs, inserts new ones.

import { getAdminFirestore } from '../src/lib/firebase/admin';
import type { Vendor } from '../src/types';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const vendors: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    slug: 'enjoy',
    name: 'Enjoy',
    website: 'https://enjoycannabis.com',
    categories: ['edibles', 'drinks'],
    isActive: true,
  },
  {
    slug: 'cannaelite',
    name: 'Cannaelite',
    website: 'https://canna-elite.com',
    categories: ['edibles', 'drinks'],
    isActive: true,
  },
  {
    slug: 'the-wildwood-company',
    name: 'The Wildwood Company',
    website: 'https://discoverwildwood.com',
    categories: ['vapes'],
    isActive: true,
  },
  {
    slug: 'wyld',
    name: 'Wyld',
    website: 'https://wyldcbd.com',
    categories: ['edibles', 'drinks'],
    isActive: true,
  },
  {
    slug: 'zenco',
    name: 'Zenco',
    website: 'https://thezenco.com',
    categories: ['accessories'],
    isActive: true,
  },
  {
    slug: 'uncle-skunks',
    name: 'Uncle Skunks',
    website: 'https://uncleskunks.com',
    categories: ['drinks'],
    isActive: true,
  },
  {
    slug: 'goodland-extracts',
    name: 'Goodland Extracts',
    website: 'https://goodlandextracts.com',
    categories: ['extracts'],
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
