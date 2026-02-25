// Run with: node scripts/seed-emulators.cjs
// Seeds the Firebase emulators with minimal deterministic data for E2E tests.
// Expects Firestore emulator on :8080 and Storage emulator on :9199.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const FIRESTORE_BASE = 'http://localhost:8080';
const STORAGE_BASE = 'http://localhost:9199';
const PROJECT = 'rush-n-relax';
const STORAGE_BUCKET = 'rush-n-relax.firebasestorage.app';
const EMULATOR_ADMIN_AUTH_HEADER = { Authorization: 'Bearer owner' };

const PRODUCT_SLUGS = ['flower', 'concentrates', 'drinks', 'edibles', 'vapes'];

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function clearFirestore() {
  const url = new URL(
    `/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    FIRESTORE_BASE
  );
  await request({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'DELETE' });
  console.log('✓ Firestore cleared');
}

async function seedFirestoreDoc(collection, docId, fields) {
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
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    },
    body
  );
  console.log(`✓ Firestore seeded: ${collection}/${docId}`);
}

async function seedStorageStub() {
  // Minimal valid MP4 stub (ftyp + mdat boxes). URL resolves; playback is not required for tests.
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

  const uploadObject = async (objectPath, contentType, bytes) => {
    const uploadPath = `/v0/b/${STORAGE_BUCKET}/o?name=${encodeURIComponent(objectPath)}&uploadType=media`;
    const uploadUrl = new URL(uploadPath, STORAGE_BASE);
    await request(
      {
        hostname: uploadUrl.hostname,
        port: uploadUrl.port,
        path: uploadUrl.pathname + uploadUrl.search,
        method: 'POST',
        headers: {
          ...EMULATOR_ADMIN_AUTH_HEADER,
          'Content-Type': contentType,
          'Content-Length': bytes.length,
        },
      },
      bytes
    );
    console.log(`✓ Storage seeded: ${objectPath}`);
  };

  // Ambient video assets loaded on startup.
  await uploadObject('ambient/smoke-4k.mp4', 'video/mp4', mp4Stub);
  await uploadObject('ambient/smoke-1080p.mp4', 'video/mp4', mp4Stub);

  // Header logo (startup fetch) from Firebase Storage.
  const primaryLogoPath = path.join(__dirname, '..', 'public', 'icons', 'logo-primary.png');
  const primaryLogoBytes = fs.existsSync(primaryLogoPath)
    ? fs.readFileSync(primaryLogoPath)
    : pngStub;
  await uploadObject('branding/logo-primary.png', 'image/png', primaryLogoBytes);

  // Secondary branding variant uses a deterministic placeholder in CI.
  await uploadObject('branding/logo-accent-blue-bg.png', 'image/png', pngStub);

  // Product cards on home load first 3 slugs; seed all known product slugs for consistency.
  for (const slug of PRODUCT_SLUGS) {
    await uploadObject(`products/${slug}.png`, 'image/png', pngStub);
  }
}

async function run() {
  console.log('Seeding Firebase emulators...');
  await clearFirestore();

  // Seed any Firestore docs your app reads on load here.
  // App startup reads static constants for data, but resolves media from Storage.

  await seedStorageStub();
  console.log('\nEmulator seed complete ✓');
}

run().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
