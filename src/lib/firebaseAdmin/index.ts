/**
 * Lazy Firebase initialization for admin operations
 * Singleton pattern ensures single app instance
 * Only initializes when actually needed (lazy loading pattern)
 *
 * This module decouples Firebase initialization from business logic,
 * making code testable and avoiding tight coupling to Firebase specifics.
 */

import { initializeApp, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

/**
 * Get or create Firebase app instance
 * Lazy loads only when first accessed
 * Returns existing instance if already initialized
 *
 * @returns Initialized Firebase app instance
 * @throws If Firebase initialization fails
 */
export function getFirebaseApp(): FirebaseApp {
  // Return cached instance if already initialized
  if (app) {
    return app;
  }

  try {
    // Try to get existing app instance first (prevents duplicate initialization)
    app = getApp();
  } catch {
    // No existing instance, create new one
    app = initializeApp(firebaseConfig);
  }

  return app;
}

/**
 * Get or create Firestore instance
 * Lazy loads only when first accessed
 * Returns existing instance if already initialized
 *
 * @returns Initialized Firestore instance
 * @throws If Firebase or Firestore initialization fails
 */
export function getFirebaseDb(): Firestore {
  // Return cached instance if already initialized
  if (db) {
    return db;
  }

  const app = getFirebaseApp();
  db = getFirestore(app);
  return db;
}

/**
 * Reset Firebase instances (for testing/cleanup)
 * Clears both app and db references
 * Use in test teardown to ensure clean state
 *
 * @internal Only for testing purposes
 */
export function resetFirebase(): void {
  app = null;
  db = null;
}

/**
 * Check if Firebase is already initialized
 * Useful for conditional logic or debugging
 *
 * @returns true if Firebase app and db are initialized
 */
export function isFirebaseInitialized(): boolean {
  return app !== null && db !== null;
}
