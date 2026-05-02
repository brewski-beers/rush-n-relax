// Run with: npx tsx scripts/purge-hub-inventory.ts
//
// One-time data cleanup for issue #314: remove the legacy `hub` virtual
// inventory location. Deletes every doc under `inventory/hub/items/*` and
// the `inventory/hub` parent doc.
//
// Idempotent: safe to re-run. Targets the Firebase emulator by default.
// Set FIRESTORE_EMULATOR_HOST explicitly (or run against prod with caution).

import { getAdminFirestore } from '../apps/web/src/lib/firebase/admin';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

async function purgeHubInventory(): Promise<void> {
  const db = getAdminFirestore();
  const itemsCol = db.collection('inventory/hub/items');

  const snap = await itemsCol.get();
  if (snap.empty) {
    console.log('inventory/hub/items: no docs to delete');
  } else {
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    console.log(`inventory/hub/items: deleted ${snap.size} doc(s)`);
  }

  // Delete the parent doc itself (may not exist as a materialized doc).
  await db
    .doc('inventory/hub')
    .delete()
    .catch(() => {
      // Parent doc may be implicit (subcollections only). Ignore.
    });
  console.log('inventory/hub: parent doc removed (if present)');
}

purgeHubInventory()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('purge-hub-inventory failed:', err);
    process.exit(1);
  });
