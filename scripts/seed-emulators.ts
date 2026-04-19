// Run with: npx tsx scripts/seed-emulators.ts
// Seeds the Firebase emulators with deterministic data for E2E tests.
// Expects Firestore emulator on :8080, Auth emulator on :9099, and Storage emulator on :9199.
//
// Writes directly to emulators via Admin SDK (Firestore/Auth) and raw HTTP (Storage).
// No JSON artifact intermediary — fixture builders are called directly.

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { UserImportRecord } from 'firebase-admin/auth';
import { getAdminFirestore, getAdminAuth } from '../src/lib/firebase/admin';
import {
  FIXTURE_TIMESTAMP,
  PROMO_FIXTURES,
  LOCATION_REVIEW_FIXTURES,
  buildLocationDocuments,
  buildProductDocuments,
  buildOnlineInventoryDocuments,
  buildRetailInventoryDocuments,
  buildCategoryDocuments,
  buildVariantTemplateDocuments,
  AUTH_USER_FIXTURES,
} from '../src/lib/fixtures';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function seedFirestoreDocuments() {
  const db = getAdminFirestore();
  const now = new Date(FIXTURE_TIMESTAMP);

  for (const loc of buildLocationDocuments(now)) {
    await db
      .collection('locations')
      .doc(loc.slug)
      .set({ ...loc });
    console.log(`✓ Firestore seeded: locations/${loc.slug}`);
  }

  for (const product of buildProductDocuments(now)) {
    await db
      .collection('products')
      .doc(product.slug)
      .set({ ...product });
    console.log(`✓ Firestore seeded: products/${product.slug}`);
  }

  for (const item of buildOnlineInventoryDocuments(now)) {
    await db
      .collection(`inventory/${item.locationId}/items`)
      .doc(item.productId)
      .set({ ...item });
    console.log(
      `✓ Firestore seeded: inventory/${item.locationId}/items/${item.productId}`
    );
  }

  for (const item of buildRetailInventoryDocuments(now)) {
    await db
      .collection(`inventory/${item.locationId}/items`)
      .doc(item.productId)
      .set({ ...item });
    console.log(
      `✓ Firestore seeded: inventory/${item.locationId}/items/${item.productId}`
    );
  }

  for (const promo of PROMO_FIXTURES) {
    await db
      .collection('promos')
      .doc(promo.slug)
      .set({
        ...promo,
        createdAt: now,
        updatedAt: now,
      });
    console.log(`✓ Firestore seeded: promos/${promo.slug}`);
  }

  for (const category of buildCategoryDocuments(now)) {
    await db
      .collection('product-categories')
      .doc(category.slug)
      .set({ ...category });
    console.log(`✓ Firestore seeded: product-categories/${category.slug}`);
  }

  for (const reviewDoc of LOCATION_REVIEW_FIXTURES) {
    await db
      .collection('location-reviews')
      .doc(reviewDoc.placeId)
      .set({ ...reviewDoc });
    console.log(`✓ Firestore seeded: location-reviews/${reviewDoc.placeId}`);
  }

  for (const tpl of buildVariantTemplateDocuments(now)) {
    await db
      .collection('variant-templates')
      .doc(tpl.id)
      .set({ ...tpl });
    console.log(`✓ Firestore seeded: variant-templates/${tpl.id}`);
  }
}

// ── Auth helpers ───────────────────────────────────────────────────────────────

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

async function seedAuthUsers() {
  const auth = getAdminAuth();
  const users: UserImportRecord[] = AUTH_USER_FIXTURES.map(user => ({
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    customClaims: { role: user.role },
    metadata: {
      creationTime: FIXTURE_TIMESTAMP,
      lastSignInTime: FIXTURE_TIMESTAMP,
    },
    providerData: user.providers.map(p => ({
      providerId: p.providerId,
      uid: p.providerUid,
      email: p.email,
      displayName: p.displayName,
    })),
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

  // Valid 1×1 white PNG — smallest valid image that renders in a browser.
  const pngStub = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // Minimal valid PDF — enough for the COA admin UI to recognise as PDF.
  const pdfStub = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj ' +
      '2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj ' +
      '3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 1 1]>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f \n' +
      'trailer<</Size 4 /Root 1 0 R>>\nstartxref\n%%EOF',
    'utf8'
  );

  // ── Upload + metadata helpers ──────────────────────────────────────────────

  const uploadObject = async (
    objectPath: string,
    contentType: string,
    bytes: Buffer
  ): Promise<void> => {
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
          'X-Goog-Upload-Header-Content-Type': contentType,
          'Content-Length': bytes.length,
        },
      },
      bytes
    );

    // Set Cache-Control metadata after upload.
    const metaPath = `/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(objectPath)}`;
    const metaBody = JSON.stringify({
      cacheControl: 'public, max-age=31536000, immutable',
    });
    const metaUrl = new URL(metaPath, STORAGE_BASE);
    await request(
      {
        hostname: metaUrl.hostname,
        port: metaUrl.port,
        path: metaUrl.pathname,
        method: 'PATCH',
        headers: {
          ...EMULATOR_AUTH,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(metaBody),
        },
      },
      metaBody
    );

    console.log(`✓ Storage seeded: ${objectPath}`);
  };

  // ── Ambient video ──────────────────────────────────────────────────────────

  await uploadObject('ambient/smoke-4k.mp4', 'video/mp4', mp4Stub);
  await uploadObject('ambient/smoke-1080p.mp4', 'video/mp4', mp4Stub);

  // ── Branding ──────────────────────────────────────────────────────────────

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

  // ── Product images — all 174 catalog slugs + gallery primary ──────────────

  const catalogPath = path.join(__dirname, 'catalog-seed-data.json');
  const catalogSlugs: string[] = fs.existsSync(catalogPath)
    ? (
        JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as Array<{
          slug: string;
        }>
      ).map(entry => entry.slug)
    : [];

  // Also include the 5 fixture product slugs used in E2E tests.
  const fixtureSlugs = ['flower', 'concentrates', 'drinks', 'edibles', 'vapes'];
  const allProductSlugs = [...new Set([...fixtureSlugs, ...catalogSlugs])];

  for (const slug of allProductSlugs) {
    await uploadObject(`products/${slug}.jpg`, 'image/jpeg', pngStub);
    await uploadObject(`products/${slug}/gallery/0.jpg`, 'image/jpeg', pngStub);
  }

  // Keep legacy .png paths for the 5 fixture products (ProductImage falls back to these).
  for (const slug of fixtureSlugs) {
    await uploadObject(`products/${slug}.png`, 'image/png', pngStub);
  }

  // ── Promo images ──────────────────────────────────────────────────────────

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

  // ── COA PDFs ──────────────────────────────────────────────────────────────

  const coaFiles = [
    'COA/Blue-Dream-2024-01.pdf',
    'COA/OG-Kush-2024-01.pdf',
    'COA/Gelato-2024-01.pdf',
    'COA/Wedding-Cake-2024-01.pdf',
    'COA/Gorilla-Glue-2024-01.pdf',
  ];
  for (const coaPath of coaFiles) {
    await uploadObject(coaPath, 'application/pdf', pdfStub);
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────

async function run() {
  console.log('Seeding Firebase emulators...');
  await clearFirestore();
  await seedFirestoreDocuments();
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
