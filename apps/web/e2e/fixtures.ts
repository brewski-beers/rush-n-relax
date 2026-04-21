import { getApps, initializeApp as initializeFirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  signInWithCredential,
} from 'firebase/auth';
import { Page } from '@playwright/test';

/**
 * Shared E2E Test Fixtures
 *
 * Common setup routines extracted to avoid redundancy across spec files.
 * Each helper targets a specific UX gate (age verification, auth, etc.)
 * and can be composed in any test that needs post-gate access.
 *
 * PATTERN: Tests should only verify the thing they're testing.
 *          Cross-cutting concerns (like age-gate) belong here.
 */

/** Default legal birthdate values for age verification bypass */
const LEGAL_DOB = {
  month: '01',
  day: '15',
  year: '1990',
};

const PLAYWRIGHT_FIREBASE_APP_NAME = 'playwright-auth-emulator';
const TEST_ADMIN_ACTOR = {
  email: 'kb@rushnrelax.com',
  displayName: 'KB',
  providerUid: 'kb-google-oauth',
};

export interface EmulatorGoogleActor {
  email: string;
  displayName: string;
  providerUid: string;
}

function getPlaywrightAuth() {
  const existingApp = getApps().find(
    app => app.name === PLAYWRIGHT_FIREBASE_APP_NAME
  );
  const app =
    existingApp ??
    initializeFirebaseApp(
      {
        apiKey: 'AIzaSyB0qrTVmQ8gRvmx-4oJ_dQHP6RA2kZ3FJk',
        authDomain: 'rush-n-relax.firebaseapp.com',
        projectId: 'rush-n-relax',
        storageBucket: 'rush-n-relax.firebasestorage.app',
        messagingSenderId: '556383052079',
        appId: '1:556383052079:web:6780513e5d7d79140f01da',
      },
      PLAYWRIGHT_FIREBASE_APP_NAME
    );
  const auth = getAuth(app);

  if (!auth.emulatorConfig) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
  }

  return auth;
}

function extractSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) {
    return null;
  }

  const match = setCookieHeader.match(/__session=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Completes age verification so tests can access post-gate pages.
 * Uses a fixed birthdate well over 21 to avoid edge-case failures.
 *
 * @param page - Playwright page instance (must already be navigated to '/')
 */
export async function verifyAge(page: Page): Promise<void> {
  const overlay = page.locator('.age-gate-overlay');

  // If already verified (localStorage persisted), skip
  const isVisible = await overlay.isVisible().catch(() => false);
  if (!isVisible) return;

  await page.locator('input[id="month"]').fill(LEGAL_DOB.month);
  await page.locator('input[id="day"]').fill(LEGAL_DOB.day);
  // Filling a 4-digit year triggers auto-submit — no button click needed
  await page.locator('input[id="year"]').fill(LEGAL_DOB.year);

  // Wait for gate to close — targeted check, not networkidle
  await overlay.waitFor({ state: 'hidden', timeout: 3000 });
}

/**
 * Sets age verification cookie before navigation so the server reads it
 * on the first request — no flash, gate never renders.
 * Fastest path — skips the UI entirely. Use when age-gate isn't under test.
 *
 * @param page - Playwright page instance (call BEFORE page.goto)
 */
export async function preVerifyAge(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'ageVerified',
      value: 'true',
      domain: 'localhost',
      path: '/',
      maxAge: 31536000,
      sameSite: 'Strict',
    },
  ]);
}

export async function establishAdminSession(page: Page): Promise<void> {
  const response = await exchangeSessionForActor(page, TEST_ADMIN_ACTOR);

  if (!response.ok()) {
    throw new Error(`Failed to create admin session (${response.status()})`);
  }

  const sessionCookie = extractSessionCookie(
    response.headers()['set-cookie'] ?? null
  );

  if (!sessionCookie) {
    throw new Error(
      'Admin session cookie was not returned by /api/auth/session'
    );
  }

  const currentUrl = new URL(page.url());
  await page.context().addCookies([
    {
      name: '__session',
      value: sessionCookie,
      domain: currentUrl.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
}

export async function exchangeSessionForActor(
  page: Page,
  actor: EmulatorGoogleActor
) {
  const auth = getPlaywrightAuth();
  const credential = GoogleAuthProvider.credential(
    JSON.stringify({
      sub: actor.providerUid,
      email: actor.email,
      email_verified: true,
      name: actor.displayName,
    })
  );
  const userCredential = await signInWithCredential(auth, credential);
  const idToken = await userCredential.user.getIdToken(true);
  const loginUrl = new URL('/api/auth/session', page.url()).toString();
  return page.context().request.post(loginUrl, {
    data: { idToken },
  });
}
