/**
 * Firebase Admin SDK singleton — server-side only.
 * Used by Server Components and API routes for privileged Firestore reads/writes.
 *
 * Auth hierarchy (in order):
 * 1. Vercel OIDC → GCP Workload Identity Federation (keyless; activates when Vercel Pro is enabled)
 * 2. Static SA key in FIREBASE_SERVICE_ACCOUNT_JSON (current production path on Vercel Hobby)
 * 3. Application Default Credentials (ADC: gcloud auth, Firebase emulators)
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

  // Phase B (Vercel OIDC → WIF): Build external account config from Vercel env vars
  // When enabled, Vercel injects VERCEL_OIDC_TOKEN automatically.
  // Firebase Admin SDK will exchange this token for a GCP bearer token via WIF.
  if (
    process.env.VERCEL_OIDC_TOKEN &&
    process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER &&
    process.env.GCP_SERVICE_ACCOUNT_EMAIL
  ) {
    const externalAccountConfig = {
      type: 'external_account',
      audience: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      credential_source: {
        environment_id: 'azure1',
        // Required by google-auth-library, but Vercel OIDC is provided via subject_token
        regional_cred_verification_url:
          'https://sts.{region}.googleapis.com/v1/validateToken?access_token={token}',
      },
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${process.env.GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
      subject_token: process.env.VERCEL_OIDC_TOKEN,
    };

    try {
      adminApp = initializeApp({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- Firebase Admin accepts credential config objects
        credential: externalAccountConfig as any,
        projectId: 'rush-n-relax',
        storageBucket: 'rush-n-relax.firebasestorage.app',
      });
      return adminApp;
    } catch (err) {
      console.warn(
        'Vercel OIDC initialization failed, falling back to next method:',
        err
      );
      // Fall through to next auth method
    }
  }

  // Fallback (during migration or if WIF fails): static SA key
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
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
    return adminApp;
  }

  // Final fallback: Application Default Credentials (ADC / gcloud auth / emulators)
  adminApp = initializeApp({
    projectId: 'rush-n-relax',
    storageBucket: 'rush-n-relax.firebasestorage.app',
  });

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
export { ONLINE_LOCATION_ID } from '../../constants/location-ids';
