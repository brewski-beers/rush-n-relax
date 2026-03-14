// Run with: npx tsx scripts/seed-emulators.ts
// Seeds the Firebase emulators with deterministic data for E2E tests.
// Expects Firestore emulator on :8080, Auth emulator on :9099, and Storage emulator on :9199.
//
// Firestore/Auth documents are loaded from generated artifacts in emulator-data/.
// Storage stubs remain scripted here until the storage fixture path is unified.

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { UserImportRecord } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAdminAuth } from '../src/lib/firebase/admin';
import type { AuthSeedArtifact } from './lib/auth-artifact';
import type { FirestoreSeedArtifact } from './lib/firestore-artifact';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const AUTH_BASE = 'http://localhost:9099';
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

async function isAuthEmulatorAvailable(): Promise<boolean> {
  const url = new URL(`/emulator/v1/projects/${PROJECT}/config`, AUTH_BASE);

  try {
    await request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
    });
    return true;
  } catch {
    return false;
  }
}

async function clearAuth() {
  const url = new URL(`/emulator/v1/projects/${PROJECT}/accounts`, AUTH_BASE);
  await request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'DELETE',
  });
  console.log('✓ Auth cleared');
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

function loadSeedArtifact(): FirestoreSeedArtifact {
  const artifactPath = resolve(
    process.cwd(),
    'emulator-data',
    'firestore.seed.json'
  );
  return JSON.parse(
    readFileSync(artifactPath, 'utf8')
  ) as FirestoreSeedArtifact;
}

function loadAuthSeedArtifact(): AuthSeedArtifact {
  const artifactPath = resolve(
    process.cwd(),
    'emulator-data',
    'auth.seed.json'
  );
  return JSON.parse(readFileSync(artifactPath, 'utf8')) as AuthSeedArtifact;
}

async function seedArtifactDocuments() {
  const artifact = loadSeedArtifact();

  for (const document of artifact.documents) {
    await seedFirestoreDoc(
      document.collection,
      document.docId,
      document.fields
    );
  }
}

async function seedAuthUsers() {
  const artifact = loadAuthSeedArtifact();
  const auth = getAdminAuth();
  const users: UserImportRecord[] = artifact.users.map(user => ({
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    customClaims: user.customClaims,
    metadata: user.metadata,
    providerData: user.providerData,
  }));
  const result = await auth.importUsers(users);

  if (result.failureCount > 0) {
    const errorSummary = result.errors
      .map(error => `${error.index}:${error.error.message}`)
      .join(', ');
    throw new Error(
      `Auth import failed (${result.failureCount}): ${errorSummary}`
    );
  }

  console.log(`✓ Auth seeded: ${result.successCount} users`);
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

async function run() {
  console.log('Seeding Firebase emulators...');
  await clearFirestore();
  await seedArtifactDocuments();
  if (await isAuthEmulatorAvailable()) {
    await clearAuth();
    await seedAuthUsers();
  } else {
    console.log('• Auth emulator not running; skipping auth seed');
  }
  await seedStorageStub();
  console.log('\nEmulator seed complete ✓');
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Seed failed:', message);
  process.exit(1);
});
