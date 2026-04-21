/**
 * Firebase Admin SDK singleton — server-side only.
 * Used by Server Components and API routes for privileged Firestore reads/writes.
 *
 * In Vercel: set FIREBASE_SERVICE_ACCOUNT_JSON env var with the service account JSON.
 * For local development, set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON.
 */
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import {
  getFirestore,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getStorage, type Storage } from 'firebase-admin/storage';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;
let adminStorage: Storage | null = null;

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse is any by design
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    );
    adminApp = initializeApp({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- serviceAccount is ServiceAccount-shaped at runtime
      credential: cert(serviceAccount),
      projectId: 'rush-n-relax',
      storageBucket: 'rush-n-relax.firebasestorage.app',
    });
  } else {
    // Application Default Credentials (App Hosting + local with gcloud auth)
    adminApp = initializeApp({
      projectId: 'rush-n-relax',
      storageBucket: 'rush-n-relax.firebasestorage.app',
    });
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
  // In Next.js dev, hot-reload clears module vars but the SDK retains the
  // Firestore instance — settings() throws if called on an already-init'd instance.
  try {
    adminDb.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Already initialized across a hot-reload boundary — safe to ignore.
  }
  return adminDb;
}

export function getAdminStorage(): Storage {
  if (adminStorage) return adminStorage;
  adminStorage = getStorage(getAdminApp());
  return adminStorage;
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

// Re-exported here for backward compatibility — canonical source is src/constants/location-ids.ts
export {
  HUB_LOCATION_ID,
  ONLINE_LOCATION_ID,
} from '../../constants/location-ids';
