/* eslint-disable no-console */
// Run with: npx tsx scripts/migrate-inventory-online-config.ts [--apply] [--project=<id>]
//
// Purpose:
// - Backfill `featured` field on all existing inventory items that are missing it.
//   This field was added to InventoryItem in the feat/update-inventory-online-config
//   branch. Prior to this migration, docs at inventory/{locationId}/items/{productId}
//   have no `featured` field. Safe default is false — admins opt in explicitly.
//
// Safety:
// - Dry-run by default (no writes)
// - Use --apply to perform writes
// - Idempotent: docs that already have `featured` are skipped
//
// Environment:
// - For emulator: set FIRESTORE_EMULATOR_HOST=localhost:8080
// - For production: provide ADC credentials (GOOGLE_APPLICATION_CREDENTIALS)

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

interface CliFlags {
  apply: boolean;
  projectId: string;
}

function parseFlags(argv: string[]): CliFlags {
  const has = (flag: string) => argv.includes(flag);

  const projectIdArg = argv.find(arg => arg.startsWith('--project='));
  const projectId =
    projectIdArg?.split('=')[1] ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    'rush-n-relax';

  return {
    apply: has('--apply'),
    projectId,
  };
}

function initFirestore(projectId: string): FirebaseFirestore.Firestore {
  if (!getApps().length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      initializeApp({ projectId });
    } else {
      initializeApp({
        projectId,
        credential: applicationDefault(),
      });
    }
  }

  return getFirestore();
}

interface ItemToBackfill {
  locationId: string;
  productId: string;
  missingFields: string[];
}

async function collectItemsToBackfill(
  db: FirebaseFirestore.Firestore
): Promise<ItemToBackfill[]> {
  // Enumerate all location buckets under inventory/
  const locationSnap = await db.collection('inventory').listDocuments();

  const toBackfill: ItemToBackfill[] = [];

  for (const locationRef of locationSnap) {
    const locationId = locationRef.id;
    const itemsSnap = await db
      .collection(`inventory/${locationId}/items`)
      .get();

    for (const doc of itemsSnap.docs) {
      const data = doc.data();
      const missingFields: string[] = [];

      if (data.featured === undefined) {
        missingFields.push('featured');
      }

      if (missingFields.length > 0) {
        toBackfill.push({
          locationId,
          productId: doc.id,
          missingFields,
        });
      }
    }
  }

  return toBackfill;
}

async function run(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const db = initFirestore(flags.projectId);

  const mode = flags.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`\n[inventory-online-config-migration] Mode: ${mode}`);
  console.log(
    `[inventory-online-config-migration] Project: ${flags.projectId}`
  );
  console.log(
    `[inventory-online-config-migration] Emulator: ${process.env.FIRESTORE_EMULATOR_HOST ?? 'no'}`
  );

  console.log('\nScanning inventory items...');
  const items = await collectItemsToBackfill(db);

  // Count total docs scanned for reporting
  const locationSnap = await db.collection('inventory').listDocuments();
  let totalScanned = 0;
  for (const locationRef of locationSnap) {
    const snap = await db.collection(`inventory/${locationRef.id}/items`).get();
    totalScanned += snap.size;
  }

  console.log(
    `\nScanned ${totalScanned} inventory item(s) across ${locationSnap.length} location(s).`
  );

  if (items.length === 0) {
    console.log('All items already have required fields. Nothing to migrate.');
    return;
  }

  console.log(`\nFound ${items.length} item(s) needing backfill:`);
  for (const item of items) {
    console.log(
      `  inventory/${item.locationId}/items/${item.productId} — missing: [${item.missingFields.join(', ')}]`
    );
  }

  if (!flags.apply) {
    console.log(
      `\nDry-run complete. ${items.length} item(s) would be updated.`
    );
    console.log('Re-run with --apply to execute writes.');
    return;
  }

  // Apply: write missing fields in batches of 500 (Firestore batch limit)
  const BATCH_SIZE = 500;
  let updated = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = items.slice(i, i + BATCH_SIZE);

    for (const item of chunk) {
      const ref = db
        .collection(`inventory/${item.locationId}/items`)
        .doc(item.productId);

      const patch: Record<string, unknown> = {};
      if (item.missingFields.includes('featured')) {
        patch.featured = false;
      }
      patch.updatedAt = Timestamp.now();

      batch.update(ref, patch);
    }

    await batch.commit();
    updated += chunk.length;
    console.log(`[batch] Wrote ${updated}/${items.length} item(s)...`);
  }

  console.log('\nMigration summary:');
  console.log(`  Total scanned: ${totalScanned}`);
  console.log(`  Items updated: ${updated}`);
  console.log(`  Fields backfilled: featured=false`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nMigration failed: ${message}`);
  process.exitCode = 1;
});
