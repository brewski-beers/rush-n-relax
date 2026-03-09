import { execSync } from 'child_process';

/**
 * Playwright global setup — runs once before all tests.
 *
 * Seeds the Firebase emulator with location-reviews and
 * tenants/rnr/{locations,products,promos} data so e2e assertions
 * have real content to verify against.
 *
 * Requires: Firebase emulators already running on their default ports.
 * Start with: npm run dev:all
 * Then test with: npm run test:e2e  (reuseExistingServer picks them up)
 *
 * If emulators are not running this logs a warning and continues —
 * tests that assert on content will fail with clear "element not found"
 * messages rather than an opaque setup crash.
 */
export default async function globalSetup() {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';

  try {
    console.log('[e2e] Seeding Firebase emulators...');

    // Seed location-reviews collection (used by reviews.spec.ts)
    execSync('node scripts/seed-emulators.cjs', {
      stdio: 'inherit',
      timeout: 15000,
    });

    // Seed tenants/rnr/{locations,products,promos} (used by app.spec.ts, user-journey.spec.ts)
    execSync('npx tsx scripts/seed-from-constants.ts', {
      stdio: 'inherit',
      timeout: 30000,
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: emulatorHost,
        NODE_ENV: 'development',
      },
    });

    console.log('[e2e] Emulator seed complete.');
  } catch (err) {
    console.warn(
      '[e2e] Emulator seed failed — are emulators running? (npm run dev:all)\n',
      err
    );
  }
}
