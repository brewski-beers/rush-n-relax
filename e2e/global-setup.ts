import { execSync } from 'child_process';

/**
 * Playwright global setup — runs once before all tests.
 *
 * Seeds the Firebase emulator with locations, products, promos,
 * and location-reviews so e2e assertions have real content to verify against.
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
  try {
    console.log(
      '[e2e] Generating emulator artifacts and seeding Firebase emulators...'
    );

    execSync('npm run dev:seed', {
      stdio: 'inherit',
      timeout: 30000,
    });

    console.log('[e2e] Emulator seed complete.');
  } catch (err) {
    console.warn(
      '[e2e] Emulator seed failed — are emulators running? (npm run dev:all)\n',
      err
    );
  }
}
