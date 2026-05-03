/**
 * AgeChecker.Net integration helpers.
 *
 * The customer-facing verification flow runs entirely in the browser via
 * the AgeChecker JS widget (see `components/AgeCheckerModal/`). The widget
 * returns a `verificationId` on success, which the cart POSTs to
 * `/api/order/start`.
 *
 * Server-side, this module owns the inbound webhook authentication
 * (`verifyAgeCheckerSignature`) — the webhook handler is defense-in-depth
 * for the same outcome the widget already reported.
 *
 * Test mode: when `AGECHECKER_TEST_MODE=true`, the webhook handler accepts
 * unsigned payloads from our own test harness. In production, HMAC
 * signature verification is enforced.
 *
 * Dashboard: https://agechecker.net
 */
import crypto from 'node:crypto';

export type AgeCheckStatus =
  | 'pass'
  | 'deny'
  | 'pending'
  | 'underage'
  | 'manual_review';

export interface AgeCheckResult {
  verificationId: string;
  status: AgeCheckStatus;
  customerEmail?: string;
}

export function isAgeCheckerTestMode(): boolean {
  return process.env.AGECHECKER_TEST_MODE === 'true';
}

/**
 * Verify an AgeChecker webhook signature.
 * Returns true if the signature matches the payload hashed with AGECHECKER_SECRET.
 * In test mode, signature verification is bypassed.
 */
export function verifyAgeCheckerSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (isAgeCheckerTestMode()) return true;
  if (!signatureHeader) return false;

  const secret = process.env.AGECHECKER_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signatureHeader, 'hex')
    );
  } catch {
    return false;
  }
}
