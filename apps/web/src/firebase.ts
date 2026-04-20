import { initializeApp as initFirebase, getApps } from 'firebase/app';
import { isEmulator } from '@/lib/firebase/env';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from 'firebase/functions';

// Firebase configuration — these values are public by design.
// They identify the project and are visible in all deployed JavaScript bundles.
// Security is enforced via Firebase Security Rules, not secrecy of these values.
export const firebaseConfig = {
  apiKey: 'AIzaSyB0qrTVmQ8gRvmx-4oJ_dQHP6RA2kZ3FJk',
  authDomain: 'rush-n-relax.firebaseapp.com',
  projectId: 'rush-n-relax',
  storageBucket: 'rush-n-relax.firebasestorage.app',
  messagingSenderId: '556383052079',
  appId: '1:556383052079:web:6780513e5d7d79140f01da',
  measurementId: 'G-MRCWGZC1F1',
};

let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;
let functions: ReturnType<typeof getFunctions> | null = null;
let analytics: ReturnType<typeof getAnalytics> | null = null;

function shouldDisableAnalytics(): boolean {
  if (
    process.env.NEXT_PUBLIC_DISABLE_ANALYTICS === 'true' ||
    process.env.NEXT_PUBLIC_E2E === 'true' ||
    process.env.NODE_ENV === 'test'
  ) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  // Blocks browser automation traffic (Playwright/Cypress/WebDriver) from GA.
  if (window.navigator.webdriver) {
    return true;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /playwright|puppeteer|cypress|headlesschrome/.test(userAgent);
}

export function initializeApp() {
  const app =
    getApps().length > 0 ? getApps()[0] : initFirebase(firebaseConfig);

  if (!db) {
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app, 'us-central1');

    if (typeof window !== 'undefined' && !shouldDisableAnalytics()) {
      analytics = getAnalytics(app);
    }

    if (isEmulator) {
      connectAuthEmulator(auth, 'http://localhost:9099', {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectStorageEmulator(storage, 'localhost', 9199);
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
  }

  return { app, auth, db, storage, functions, analytics };
}

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

export function trackEvent(
  eventName: string,
  eventData?: Record<string, unknown>
) {
  if (analytics) {
    logEvent(analytics, eventName, eventData);
  }
}

export function trackPageView(pageName: string) {
  trackEvent('page_view', {
    page_title: pageName,
    page_location: typeof window !== 'undefined' ? window.location.href : '',
  });
}

export function callFunction<TReq, TRes>(name: string) {
  return async (data: TReq): Promise<TRes> => {
    const fns = getFunctions$();
    const callable = httpsCallable<TReq, TRes>(fns, name);
    const result = await callable(data);
    return result.data;
  };
}

export { db };
