/**
 * Single source of truth for Firebase runtime environment.
 *
 * Import `isEmulator` from here — never inline these checks in SDK init files.
 *
 * true  → route to local emulators (localhost:8080, :9199, :5001)
 * false → route to production Firebase (via config object)
 *
 * Note: FIRESTORE_EMULATOR_HOST is intentionally excluded — the Firebase Admin
 * SDK reads that env var natively (v10+), so no custom routing code is needed
 * for that path (used by plain Node seed scripts).
 */
export const isEmulator: boolean =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
