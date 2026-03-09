/**
 * Firebase Admin SDK singleton — server-side only.
 * Used by Server Components and API routes for privileged Firestore reads/writes.
 *
 * In Firebase App Hosting the environment is auto-configured with Application Default
 * Credentials — no explicit service account key needed in production.
 * For local development, set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON.
 */
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import {
  getFirestore,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  // In Firebase App Hosting: ADC provides credentials automatically.
  // In CI/local dev: GOOGLE_APPLICATION_CREDENTIALS env var points to service account.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Allow passing service account as an env var JSON string (useful in some CI envs)
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    );
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: 'rush-n-relax',
    });
  } else {
    // Application Default Credentials (App Hosting + local with gcloud auth)
    adminApp = initializeApp({ projectId: 'rush-n-relax' });
  }

  return adminApp;
}

export function getAdminAuth(): Auth {
  if (adminAuth) return adminAuth;
  adminAuth = getAuth(getAdminApp());
  return adminAuth;
}

export function getAdminFirestore(): Firestore {
  if (adminDb) return adminDb;
  adminDb = getFirestore(getAdminApp());
  return adminDb;
}

/**
 * Convert a Firestore Admin Timestamp (or plain Date) to a JS Date.
 * Use when reading documents from Firestore — field values arrive as Timestamps.
 */
export function toDate(value: Timestamp | Date | string | undefined): Date {
  if (!value) return new Date(0);
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
}

/**
 * Standard tenant ID for Rush N Relax (single-tenant in Phase 1).
 * Swap out for dynamic tenant resolution once Phase 5 multi-tenant is active.
 */
export const DEFAULT_TENANT_ID = 'rnr';

/**
 * Reserved inventory location ID for the RnR Hub (warehouse/non-physical).
 * Hub items can be flagged availableOnline: true to promote to the storefront.
 * No Firestore Location document exists for this ID — it is a code constant only.
 */
export const HUB_LOCATION_ID = 'hub';
