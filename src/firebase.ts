import { initializeApp as initFirebase } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from 'firebase/functions';

// Firebase configuration - these values are public by design
// They identify the project and are visible in all deployed JavaScript bundles
// Security is enforced via Firebase Security Rules, not secrecy of these values
export const firebaseConfig = {
  apiKey: 'AIzaSyB0qrTVmQ8gRvmx-4oJ_dQHP6RA2kZ3FJk',
  authDomain: 'rush-n-relax.firebaseapp.com',
  projectId: 'rush-n-relax',
  storageBucket: 'rush-n-relax.firebasestorage.app',
  messagingSenderId: '556383052079',
  appId: '1:556383052079:web:6780513e5d7d79140f01da',
  measurementId: 'G-MRCWGZC1F1',
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
    functions = getFunctions(app, 'us-central1');
    analytics = getAnalytics(app);

    if (import.meta.env.DEV || import.meta.env.VITE_USE_EMULATORS === 'true') {
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectStorageEmulator(storage, 'localhost', 9199);
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
  }
  return { app, db, storage, functions, analytics };
}

// Lazy getters that ensure the instance is initialized
export function getFirestore$() {
  if (!db)
    throw new Error('Firestore not initialized. Call initializeApp() first.');
  return db;
}

export function getStorage$() {
  if (!storage)
    throw new Error(
      'Firebase Storage not initialized. Call initializeApp() first.'
    );
  return storage;
}

export function getFunctions$() {
  if (!functions)
    throw new Error(
      'Firebase Functions not initialized. Call initializeApp() first.'
    );
  return functions;
}

export function getAnalytics$() {
  if (!analytics)
    throw new Error(
      'Firebase Analytics not initialized. Call initializeApp() first.'
    );
  return analytics;
}

/**
 * Track analytics event
 * @param eventName - Name of the event (e.g., 'page_view', 'form_submit')
 * @param eventData - Optional event data
 */
export function trackEvent(
  eventName: string,
  eventData?: Record<string, unknown>
) {
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

/**
 * Create a typed callable function wrapper.
 * Ensures Firebase is initialized before calling.
 */
export function callFunction<TReq, TRes>(name: string) {
  return async (data: TReq): Promise<TRes> => {
    const fns = getFunctions$();
    const callable = httpsCallable<TReq, TRes>(fns, name);
    const result = await callable(data);
    return result.data;
  };
}

export { db };
