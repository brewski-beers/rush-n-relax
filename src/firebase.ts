import { initializeApp as initFirebase } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Support both Vite runtime (import.meta.env) and Node/seed scripts (process.env)
const env = typeof import.meta !== 'undefined' && (import.meta as any)?.env
  ? (import.meta as any).env
  : process.env;

export const firebaseConfig = {
  apiKey: env?.VITE_FIREBASE_API_KEY,
  authDomain: env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env?.VITE_FIREBASE_APP_ID,
};

let app: ReturnType<typeof initFirebase> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;
let functions: ReturnType<typeof getFunctions> | null = null;

export function initializeApp() {
  if (!app) {
    app = initFirebase(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app);

    if (import.meta.env.DEV) {
      connectAuthEmulator(auth, 'http://localhost:9099', {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectStorageEmulator(storage, 'localhost', 9199);
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
  }
  return { app, auth, db, storage, functions };
}

// Lazy getters that ensure the instance is initialized
export function getAuth$() {
  if (!auth) throw new Error('Firebase Auth not initialized. Call initializeApp() first.');
  return auth;
}

export function getFirestore$() {
  if (!db) throw new Error('Firestore not initialized. Call initializeApp() first.');
  return db;
}

export function getStorage$() {
  if (!storage) throw new Error('Firebase Storage not initialized. Call initializeApp() first.');
  return storage;
}

export function getFunctions$() {
  if (!functions) throw new Error('Firebase Functions not initialized. Call initializeApp() first.');
  return functions;
}
