/**
 * AgeChecker.Net integration helpers.
 *
 * Test mode: when AGECHECKER_TEST_MODE=true, webhook handler accepts unsigned
 * payloads from our own test harness and simulates deterministic outcomes.
 * In production, HMAC signature verification is enforced.
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

// ─── Session start ───────────────────────────────────────────────────

export interface AgeCheckerSessionInput {
  orderId: string;
  customerEmail?: string;
  /** Where AgeChecker should redirect the user once verification finishes. */
  returnUrl: string;
}

export interface AgeCheckerSession {
  /** AgeChecker session id we persist on the order for webhook correlation. */
  sessionId: string;
  /** URL the storefront should redirect the user to. */
  redirectUrl: string;
  provider: 'agechecker' | 'stub';
}

/**
 * Start an AgeChecker hosted verification session.
 *
 * ⚠️  STUBBED until production keys + endpoint contract are confirmed. When
 *     AGECHECKER_API_KEY is absent we return a deterministic stub so the rest
 *     of the storefront flow is exercisable end-to-end. Mirrors the pattern
 *     used by `createCloverCheckoutSession`.
 */
export function startAgeCheckerSession(
  input: AgeCheckerSessionInput
): Promise<AgeCheckerSession> {
  const apiKey = process.env.AGECHECKER_API_KEY;
  const merchantId = process.env.AGECHECKER_MERCHANT_ID;

  if (!apiKey || !merchantId) {
    return Promise.resolve({
      sessionId: `stub-ac-${input.orderId}`,
      redirectUrl: `/checkout/agecheck-stub?order=${encodeURIComponent(input.orderId)}`,
      provider: 'stub',
    });
  }

  // Real provider call lands here once contract is finalized.
  return Promise.resolve({
    sessionId: `stub-ac-${input.orderId}`,
    redirectUrl: `/checkout/agecheck-stub?order=${encodeURIComponent(input.orderId)}`,
    provider: 'stub',
  });
}
