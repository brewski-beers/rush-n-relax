/**
 * Firebase Admin bootstrap for seeding and server-side utilities.
 * Uses emulator when FIRESTORE_EMULATOR_HOST is set; otherwise relies on
 * default credentials or a provided projectId fallback for local dev.
 */
import admin from 'firebase-admin';

// Reuse existing app if already initialized
const app = admin.apps.length
  ? admin.app()
  : admin.initializeApp(
      process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG
        ? undefined
        : { projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'rush-n-relax' }
    );

const db = app.firestore();

// Point Admin SDK at the emulator when configured
if (process.env.FIRESTORE_EMULATOR_HOST) {
  db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
}

export { app as adminApp, db as adminDb };
export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
