/* eslint-disable no-console */
import {
  initializeApp,
  cert,
  getApps,
  type ServiceAccount,
} from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseServiceAccount(json: string): ServiceAccount {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null)
    throw new Error('Invalid serviceAccountKey.json');
  const p = parsed as Record<string, unknown>;
  if (
    typeof p.project_id !== 'string' ||
    typeof p.private_key !== 'string' ||
    typeof p.client_email !== 'string'
  ) {
    throw new Error('serviceAccountKey.json missing required fields');
  }
  return {
    projectId: p.project_id,
    privateKey: p.private_key,
    clientEmail: p.client_email,
  };
}

const keyPath = resolve('./serviceAccountKey.json');
const serviceAccount = parseServiceAccount(readFileSync(keyPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: 'rush-n-relax',
  });
}

const db = getFirestore();

const VENDOR_LOGOS: Record<string, string> = {
  cannaelite:
    'https://canna-elite.com/wp-content/uploads/2024/04/CE-Logo_9_Logo-Metallic-Gold-Photoshop-PNG-1-104x104.png',
  'the-wildwood-company':
    'https://discoverwildwood.com/cdn/shop/files/Wildwood_2026.png?v=1769548478',
  wyld: 'https://wyldcbd.com/cdn/shop/t/61/assets/header-plain-logo.svg?v=41270646523304802911711507020',
  zenco:
    'https://thezenco.com/cdn/shop/files/customcolor_logo_transparent_background_1.png?v=1691422448&width=2454',
  'uncle-skunks':
    'https://uncleskunks.com/cdn/shop/files/Uncle_Skunks_Web_Logo2.png?v=1744948352&width=600',
  'goodland-extracts':
    'https://goodlandextracts.com/wp-content/uploads/2021/05/cropped-goodland-fav.png',
};

async function patchVendorLogos() {
  const now = FieldValue.serverTimestamp();
  let patched = 0;

  for (const [slug, logoUrl] of Object.entries(VENDOR_LOGOS)) {
    await db
      .collection('vendors')
      .doc(slug)
      .set({ logoUrl, updatedAt: now }, { merge: true });
    console.log(`  patched: vendors/${slug}`);
    patched++;
  }

  console.log(
    `\nDone — patched ${patched} vendors. Skipped: enjoy (domain parked).`
  );
}

patchVendorLogos().catch(err => {
  console.error(err);
  process.exit(1);
});
