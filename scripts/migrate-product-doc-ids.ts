/* eslint-disable no-console */
// Run with: npx tsx scripts/migrate-product-doc-ids.ts [--apply] [--delete-legacy]
//
// Purpose:
// - Normalize products so every document uses slug as doc ID: products/{slug}
// - Support legacy datasets where docs were created with auto-generated IDs
//
// Safety:
// - Dry-run by default (no writes)
// - Use --apply to perform writes
// - Use --delete-legacy to remove old auto-ID docs after successful copy
//
// Environment:
// - For emulator: set FIRESTORE_EMULATOR_HOST=localhost:8080
// - For non-emulator: provide ADC credentials (GOOGLE_APPLICATION_CREDENTIALS)

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

interface CliFlags {
  apply: boolean;
  deleteLegacy: boolean;
  projectId: string;
}

interface LegacyProductDoc {
  id: string;
  slug: string;
  data: FirebaseFirestore.DocumentData;
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
    deleteLegacy: has('--delete-legacy'),
    projectId,
  };
}

function initFirestore(projectId: string) {
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

async function collectLegacyDocs(
  db: FirebaseFirestore.Firestore
): Promise<LegacyProductDoc[]> {
  const snap = await db.collection('products').get();

  const legacyDocs: LegacyProductDoc[] = [];

  for (const doc of snap.docs) {
    // Firestore DocumentData is intentionally dynamic for migration scripts.

    const data = doc.data();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const slugValue = data.slug;

    if (typeof slugValue !== 'string' || slugValue.trim() === '') {
      continue;
    }

    const normalizedSlug = slugValue.trim().toLowerCase();
    if (doc.id === normalizedSlug) {
      continue;
    }

    legacyDocs.push({
      id: doc.id,
      slug: normalizedSlug,
      data,
    });
  }

  return legacyDocs;
}

async function run(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const db = initFirestore(flags.projectId);

  const mode = flags.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`\n[products-docid-migration] Mode: ${mode}`);
  console.log(`[products-docid-migration] Project: ${flags.projectId}`);
  console.log(
    `[products-docid-migration] Emulator: ${process.env.FIRESTORE_EMULATOR_HOST ?? 'no'}`
  );

  const legacyDocs = await collectLegacyDocs(db);

  if (!legacyDocs.length) {
    console.log('\nNo legacy product docs found. Nothing to migrate.');
    return;
  }

  console.log(`\nFound ${legacyDocs.length} legacy product doc(s):`);
  for (const legacy of legacyDocs) {
    console.log(`- ${legacy.id} -> ${legacy.slug}`);
  }

  let copied = 0;
  let deleted = 0;
  let conflicts = 0;
  let skipped = 0;

  for (const legacy of legacyDocs) {
    const sourceRef = db.collection('products').doc(legacy.id);
    const targetRef = db.collection('products').doc(legacy.slug);

    const targetSnap = await targetRef.get();

    if (targetSnap.exists) {
      conflicts += 1;
      console.log(
        `[conflict] ${legacy.id} -> ${legacy.slug} (target already exists; skipped)`
      );
      continue;
    }

    if (!flags.apply) {
      skipped += 1;
      console.log(`[plan] copy ${legacy.id} -> ${legacy.slug}`);
      if (flags.deleteLegacy) {
        console.log(`[plan] delete legacy ${legacy.id} after copy`);
      }
      continue;
    }

    // Preserve existing fields and enforce canonical slug field consistency.
    const nextPayload = {
      ...legacy.data,
      slug: legacy.slug,
      updatedAt: Timestamp.now(),
    };

    await targetRef.set(nextPayload, { merge: true });
    copied += 1;
    console.log(`[copied] ${legacy.id} -> ${legacy.slug}`);

    if (flags.deleteLegacy) {
      await sourceRef.delete();
      deleted += 1;
      console.log(`[deleted] ${legacy.id}`);
    }
  }

  console.log('\nMigration summary:');
  console.log(`- Legacy docs found: ${legacyDocs.length}`);
  console.log(`- Copied: ${copied}`);
  console.log(`- Deleted legacy: ${deleted}`);
  console.log(`- Conflicts skipped: ${conflicts}`);
  console.log(`- Dry-run planned: ${skipped}`);

  if (!flags.apply) {
    console.log('\nDry-run complete. Re-run with --apply to execute writes.');
    if (flags.deleteLegacy) {
      console.log('Legacy deletes will execute only when --apply is also set.');
    }
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nMigration failed: ${message}`);
  process.exitCode = 1;
});
