/**
 * Resolves a Firebase Storage path to a public download URL.
 *
 * Public Storage objects have a deterministic URL — no signing, no Admin SDK
 * call, no expiry. This is pure string construction: zero network round-trips
 * at any scale. The emulator variant swaps the host to localhost:9199.
 *
 * `clearStorageUrlCache` is a no-op kept for test compatibility.
 */

const STORAGE_BUCKET = 'rush-n-relax.firebasestorage.app';

function isEmulatorEnv(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

export function getStorageUrl(storagePath: string): string {
  const encodedPath = encodeURIComponent(storagePath);
  if (isEmulatorEnv()) {
    return `http://localhost:9199/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media`;
  }
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media`;
}

export function clearStorageUrlCache(): void {
  // no-op — URL construction is stateless, nothing to clear
}
