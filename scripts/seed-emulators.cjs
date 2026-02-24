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
  // Upload a minimal valid MP4 stub (ftyp + mdat boxes) so getDownloadURL resolves.
  // 32-byte minimal ftyp box — browsers won't play it but the URL resolves correctly.
  const stub = Buffer.from(
    '0000002066747970' + // ftyp box size + type
    '6d703432' +         // mp42
    '00000000' +         // minor version
    '6d703432' +         // compatible brand
    '69736f6d' +         // isom
    '00000008' +         // mdat box size
    '6d646174',          // mdat type
    'hex'
  );

  const bucketName = `${PROJECT}.appspot.com`;
  // Storage emulator REST upload endpoint
  const uploadPath = `/v0/b/${bucketName}/o?name=ambient%2Fsmoke-4k.mp4&uploadType=media`;
  const uploadPathMobile = `/v0/b/${bucketName}/o?name=ambient%2Fsmoke-1080p.mp4&uploadType=media`;

  const uploadUrl = new URL(uploadPath, STORAGE_BASE);
  await request(
    {
      hostname: uploadUrl.hostname,
      port: uploadUrl.port,
      path: uploadUrl.pathname + uploadUrl.search,
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': stub.length },
    },
    stub
  );
  console.log('✓ Storage seeded: ambient/smoke-4k.mp4');

  const uploadUrlMobile = new URL(uploadPathMobile, STORAGE_BASE);
  await request(
    {
      hostname: uploadUrlMobile.hostname,
      port: uploadUrlMobile.port,
      path: uploadUrlMobile.pathname + uploadUrlMobile.search,
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': stub.length },
    },
    stub
  );
  console.log('✓ Storage seeded: ambient/smoke-1080p.mp4');
}

async function run() {
  console.log('Seeding Firebase emulators...');
  await clearFirestore();

  // Seed any Firestore docs your app reads on load here.
  // Currently the app reads no Firestore docs on page load (products/locations
  // are static constants), so only Storage needs seeding.

  await seedStorageStub();
  console.log('\nEmulator seed complete ✓');
}

run().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
