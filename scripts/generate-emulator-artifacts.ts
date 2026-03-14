/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildAuthSeedArtifact } from './lib/auth-artifact';
import { buildStorefrontSeedArtifact } from './lib/firestore-artifact';

const OUTPUT_DIR = resolve(process.cwd(), 'emulator-data');
const FIRESTORE_OUTPUT_FILE = resolve(OUTPUT_DIR, 'firestore.seed.json');
const AUTH_OUTPUT_FILE = resolve(OUTPUT_DIR, 'auth.seed.json');

function main(): void {
  const firestoreArtifact = buildStorefrontSeedArtifact();
  const authArtifact = buildAuthSeedArtifact();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    FIRESTORE_OUTPUT_FILE,
    `${JSON.stringify(firestoreArtifact, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    AUTH_OUTPUT_FILE,
    `${JSON.stringify(authArtifact, null, 2)}\n`,
    'utf8'
  );

  console.log(
    `[generate-emulator-artifacts] Wrote ${firestoreArtifact.documents.length} Firestore docs to ${FIRESTORE_OUTPUT_FILE}`
  );
  console.log(
    `[generate-emulator-artifacts] Wrote ${authArtifact.users.length} Auth users to ${AUTH_OUTPUT_FILE}`
  );
  console.log(
    `[generate-emulator-artifacts] Dataset version: ${firestoreArtifact.datasetVersion}`
  );
}

main();
