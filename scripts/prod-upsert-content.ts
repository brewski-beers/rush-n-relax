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
import {
  LOCATION_FIXTURES,
  LOCATION_SLUGS,
  PRODUCT_FIXTURES,
  PROMO_FIXTURES,
} from '../src/lib/fixtures';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseServiceAccount(json: string): ServiceAccount {
  const parsed: unknown = JSON.parse(json);

  if (!isRecord(parsed)) {
    throw new Error('Invalid serviceAccountKey.json payload.');
  }

  const projectId = parsed.project_id;
  const privateKey = parsed.private_key;
  const clientEmail = parsed.client_email;

  if (
    typeof projectId !== 'string' ||
    typeof privateKey !== 'string' ||
    typeof clientEmail !== 'string'
  ) {
    throw new Error('serviceAccountKey.json is missing required credentials.');
  }

  return {
    projectId,
    privateKey,
    clientEmail,
  };
}

const projectId = process.env.FIREBASE_PROJECT_ID || 'rush-n-relax';
const keyPath = resolve('./serviceAccountKey.json');
const serviceAccount = parseServiceAccount(readFileSync(keyPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId,
  });
}

const db = getFirestore();
const now = FieldValue.serverTimestamp();

async function upsertLocations(): Promise<number> {
  let written = 0;

  for (const location of LOCATION_FIXTURES) {
    await db
      .collection('locations')
      .doc(location.slug)
      .set(
        {
          slug: location.slug,
          name: location.name,
          address: location.address,
          city: location.city,
          state: location.state,
          zip: location.zip,
          phone: location.phone,
          hours: location.hours,
          description: location.description,
          placeId: location.placeId,
          ...(location.coordinates
            ? { coordinates: location.coordinates }
            : {}),
          ...(location.socialLinkIds
            ? { socialLinkIds: location.socialLinkIds }
            : {}),
          ...(location.seoDescription
            ? { seoDescription: location.seoDescription }
            : {}),
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

    written += 1;
  }

  return written;
}

async function upsertProducts(): Promise<number> {
  let written = 0;

  for (const product of PRODUCT_FIXTURES) {
    await db
      .collection('products')
      .doc(product.slug)
      .set(
        {
          slug: product.slug,
          name: product.name,
          category: product.category,
          description: product.description,
          details: product.details,
          image: product.image,
          status: product.status,
          federalDeadlineRisk: product.federalDeadlineRisk,
          ...(product.coaUrl ? { coaUrl: product.coaUrl } : {}),
          availableAt: product.availableAt ?? LOCATION_SLUGS,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

    written += 1;
  }

  return written;
}

async function upsertPromos(): Promise<number> {
  let written = 0;

  for (const promo of PROMO_FIXTURES) {
    await db
      .collection('promos')
      .doc(promo.slug)
      .set(
        {
          promoId: promo.promoId,
          slug: promo.slug,
          name: promo.name,
          tagline: promo.tagline,
          description: promo.description,
          details: promo.details,
          cta: promo.cta,
          ctaPath: promo.ctaPath,
          active: promo.active,
          ...(promo.image ? { image: promo.image } : {}),
          ...(promo.locationSlug ? { locationSlug: promo.locationSlug } : {}),
          ...(promo.keywords ? { keywords: promo.keywords } : {}),
          ...(promo.startDate ? { startDate: promo.startDate } : {}),
          ...(promo.endDate ? { endDate: promo.endDate } : {}),
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

    written += 1;
  }

  return written;
}

async function main(): Promise<void> {
  console.log('[prod-upsert-content] Starting upsert...');
  console.log(`[prod-upsert-content] Project: ${projectId}`);

  const [locations, products, promos] = await Promise.all([
    upsertLocations(),
    upsertProducts(),
    upsertPromos(),
  ]);

  console.log(
    `[prod-upsert-content] Done: locations=${locations}, products=${products}, promos=${promos}`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[prod-upsert-content] Failed: ${message}`);
  process.exitCode = 1;
});
