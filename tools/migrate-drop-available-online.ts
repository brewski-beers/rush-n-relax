/* eslint-disable no-console */
// Run with: npx tsx tools/migrate-drop-available-online.ts [--apply] [--project=<id>]
//
// Purpose:
// - One-time migration to remove the vestigial `availableOnline` field from every
//   inventory item document under inventory/{locationId}/items/{productId}.
// - `inventory/online` is the canonical path for storefront visibility; the old
//   `availableOnline` boolean was a redundant gate.
//
// Safety:
// - Dry-run by default (no writes). Use --apply to perform writes.
// - Idempotent: docs without `availableOnline` are skipped; re-running reports 0 changes.
// - Destructive against production — emulator-first, then KB sign-off for prod.
//
// Environment:
// - Emulator: set FIRESTORE_EMULATOR_HOST=localhost:8080
// - Production: provide ADC credentials (GOOGLE_APPLICATION_CREDENTIALS)

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

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

  // Accept --apply (preferred) and treat absence as dry-run. Also accept
  // --dry-run as an explicit no-op synonym for clarity in runbooks.
  return {
    apply: has('--apply') && !has('--dry-run'),
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

interface ItemToClean {
  locationId: string;
  productId: string;
}

async function collectItemsWithField(
  db: FirebaseFirestore.Firestore
): Promise<{
  toClean: ItemToClean[];
  totalScanned: number;
  locationCount: number;
}> {
  const locationRefs = await db.collection('inventory').listDocuments();

  const toClean: ItemToClean[] = [];
  let totalScanned = 0;

  for (const locationRef of locationRefs) {
    const locationId = locationRef.id;
    const itemsSnap = await db
      .collection(`inventory/${locationId}/items`)
      .get();

    totalScanned += itemsSnap.size;

    for (const doc of itemsSnap.docs) {
      const data = doc.data();
      if (Object.prototype.hasOwnProperty.call(data, 'availableOnline')) {
        toClean.push({ locationId, productId: doc.id });
      }
    }
  }

  return { toClean, totalScanned, locationCount: locationRefs.length };
}

async function run(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const db = initFirestore(flags.projectId);

  const mode = flags.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`\n[drop-available-online] Mode: ${mode}`);
  console.log(`[drop-available-online] Project: ${flags.projectId}`);
  console.log(
    `[drop-available-online] Emulator: ${process.env.FIRESTORE_EMULATOR_HOST ?? 'no'}`
  );

  console.log('\nScanning inventory items...');
  const { toClean, totalScanned, locationCount } =
    await collectItemsWithField(db);

  console.log(
    `\nScanned ${totalScanned} inventory item(s) across ${locationCount} location(s).`
  );

  if (toClean.length === 0) {
    console.log(
      'No items carry the `availableOnline` field. Nothing to migrate.'
    );
    return;
  }

  console.log(`\nFound ${toClean.length} item(s) with \`availableOnline\`:`);
  for (const item of toClean) {
    console.log(
      `  inventory/${item.locationId}/items/${item.productId} — will delete availableOnline`
    );
  }

  if (!flags.apply) {
    console.log(
      `\nDry-run complete. ${toClean.length} item(s) would have \`availableOnline\` deleted.`
    );
    console.log('Re-run with --apply to execute writes.');
    return;
  }

  // Apply: delete field in batches of 500 (Firestore batch limit).
  const BATCH_SIZE = 500;
  let updated = 0;

  for (let i = 0; i < toClean.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toClean.slice(i, i + BATCH_SIZE);

    for (const item of chunk) {
      const ref = db
        .collection(`inventory/${item.locationId}/items`)
        .doc(item.productId);

      batch.update(ref, {
        availableOnline: FieldValue.delete(),
        updatedAt: Timestamp.now(),
      });
    }

    await batch.commit();
    updated += chunk.length;
    console.log(`[batch] Wrote ${updated}/${toClean.length} item(s)...`);
  }

  console.log('\nMigration summary:');
  console.log(`  Total scanned: ${totalScanned}`);
  console.log(`  Items updated: ${updated}`);
  console.log(`  Field removed: availableOnline`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nMigration failed: ${message}`);
  process.exitCode = 1;
});
