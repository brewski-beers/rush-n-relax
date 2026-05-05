/**
 * AgeChecker.net integration helpers (server side).
 *
 * Live flow: the customer-facing popup (loaded via
 * `components/AgeCheckerModal/AgeCheckerLiveButton`) runs on the order page
 * AFTER the order has been created in `pending_id_verification`. The popup
 * has **no JS callback** — verification arrives at
 * `/api/webhooks/agechecker/route.ts` and drives the order's state machine.
 *
 * Test mode (`AGECHECKER_TEST_MODE=true`): the webhook handler accepts
 * unsigned payloads from our own test harness, and the cart's simulate
 * modal short-circuits the popup by submitting a synthetic `verificationId`
 * directly to `/api/order/start`. In production, HMAC signature
 * verification is enforced.
 *
 * Dashboard: https://agechecker.net
 * Client docs: https://agechecker.net/account/install/custom/client
 * Server docs: https://agechecker.net/account/install/custom/server
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
