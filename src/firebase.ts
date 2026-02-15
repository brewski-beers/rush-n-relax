import { initializeApp as initFirebase } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';
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
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;
let functions: ReturnType<typeof getFunctions> | null = null;
let analytics: ReturnType<typeof getAnalytics> | null = null;

export function initializeApp() {
  if (!app) {
    app = initFirebase(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app);
    analytics = getAnalytics(app);

    if (import.meta.env.DEV) {
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectStorageEmulator(storage, 'localhost', 9199);
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
  }
  return { app, db, storage, functions, analytics };
}

// Lazy getters that ensure the instance is initialized
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

export function getAnalytics$() {
  if (!analytics) throw new Error('Firebase Analytics not initialized. Call initializeApp() first.');
  return analytics;
}

/**
 * Track analytics event
 * @param eventName - Name of the event (e.g., 'page_view', 'form_submit')
 * @param eventData - Optional event data
 */
export function trackEvent(eventName: string, eventData?: Record<string, any>) {
  if (analytics) {
    logEvent(analytics, eventName, eventData);
  }
}

/**
 * Track page view
 * @param pageName - Name of the page (e.g., 'home', 'about')
 */
export function trackPageView(pageName: string) {
  trackEvent('page_view', {
    page_title: pageName,
    page_location: window.location.href,
  });
}

export { db };
