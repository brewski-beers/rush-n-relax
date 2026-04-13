/**
 * Lightweight JWT payload decoder for Edge Runtime (middleware).
 *
 * Only base64-decodes the payload segment — NO signature verification.
 * Full cryptographic verification happens in requireRole() via Firebase Admin SDK
 * in every Server Action that needs it.
 */

/**
 * Decode the payload of a JWT string.
 * Returns the parsed JSON object on success, or null on any error (never throws).
 */
export function decodeJwtPayload(token: string): unknown {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // base64url → standard base64
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}
