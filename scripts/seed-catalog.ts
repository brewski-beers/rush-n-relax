// Run with: npx tsx scripts/seed-catalog.ts
// Seeds the products collection into the Firebase emulator from catalog-seed-data.json.
// Expects Firestore emulator on :8080.
// Idempotent: updates existing docs, inserts new ones.

import { getAdminFirestore } from '../src/lib/firebase/admin';
import type { Product } from '../src/types';
import { readFileSync } from 'fs';
import { join } from 'path';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const dataPath = join(__dirname, 'catalog-seed-data.json');

let rawProducts: (Omit<Product, 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
})[];

try {
  const contents = readFileSync(dataPath, 'utf-8');
  rawProducts = JSON.parse(contents) as typeof rawProducts;
} catch (err) {
  console.warn(`catalog-seed-data.json not found — skipping catalog seed.`);
  console.warn('Run /scrape-catalog locally to generate it.');
  process.exit(0);
}

async function seedCatalog() {
  const db = getAdminFirestore();
  const col = db.collection('products');
  const now = new Date();

  let created = 0;
  let updated = 0;

  for (const raw of rawProducts) {
    const { createdAt: rawCreatedAt, ...rest } = raw;
    const product = {
      ...rest,
      createdAt: rawCreatedAt ? new Date(rawCreatedAt) : now,
      updatedAt: now,
    };

    const docRef = col.doc(product.slug);
    const existing = await docRef.get();

    if (existing.exists) {
      await docRef.update({ ...product, updatedAt: now });
      console.log(`  updated: products/${product.slug}`);
      updated++;
    } else {
      await docRef.set({
        ...product,
        createdAt: product.createdAt,
        updatedAt: now,
      });
      console.log(`  created: products/${product.slug}`);
      created++;
    }
  }

  console.log(
    `\nSeeded ${rawProducts.length} products (${created} created, ${updated} updated).`
  );
}

seedCatalog().catch(err => {
  console.error(err);
  process.exit(1);
});
