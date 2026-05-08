/**
 * AgeChecker.Net integration helpers.
 *
 * The customer-facing verification flow runs entirely in the browser via
 * the AgeChecker JS widget (see `components/AgeCheckerGuard/`). The widget
 * returns a `verificationId` on success, which the verify page submits as
 * part of the checkout-session flow.
 *
 * Server-side, this module owns:
 *   - inbound webhook authentication (`verifyAgeCheckerSignature`)
 *   - server-side verificationId lookup (`verifyVerificationId`) — defense
 *     in depth before trusting webhook payloads.
 *
 * Test mode: when `AGECHECKER_TEST_MODE=true`, the webhook handler accepts
 * unsigned payloads and `verifyVerificationId` accepts ids matching
 * `test-verify-*` without a network call.
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

export interface VerifyVerificationIdResult {
  valid: boolean;
  status: AgeCheckStatus;
  verifiedAt?: Date;
  customerEmail?: string;
}

const DEFAULT_API_BASE = 'https://api.agechecker.net';
const VERIFICATION_PATH = '/api/verification'; // GET {base}{path}/{uuid}

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

function normalizeStatus(raw: unknown): AgeCheckStatus {
  if (typeof raw !== 'string') return 'pending';
  const v = raw.toLowerCase();
  switch (v) {
    case 'pass':
    case 'passed':
    case 'approved':
    case 'verified':
      return 'pass';
    case 'deny':
    case 'denied':
    case 'rejected':
    case 'fail':
    case 'failed':
      return 'deny';
    case 'underage':
      return 'underage';
    case 'manual_review':
    case 'manual':
    case 'review':
      return 'manual_review';
    case 'pending':
    default:
      return 'pending';
  }
}

function parseDate(raw: unknown): Date | undefined {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Server-side lookup of an AgeChecker verificationId. Used as defense in depth
 * before trusting a webhook payload or a client-reported verificationId.
 *
 * Endpoint: `GET {AGECHECKER_API_BASE}/api/verification/{id}`
 *   - Default base: https://api.agechecker.net
 *   - Auth: `Authorization: Bearer {AGECHECKER_API_KEY}`
 *
 * Returns `valid: true` only when the looked-up record reports a `pass` status.
 * Network errors, non-2xx responses, missing config, and unknown ids all
 * resolve to `valid: false` — this function does not throw.
 *
 * In test mode (`AGECHECKER_TEST_MODE=true`), ids matching `test-verify-*`
 * resolve to `{ valid: true, status: 'pass' }` with no network call.
 */
export async function verifyVerificationId(
  id: string
): Promise<VerifyVerificationIdResult> {
  if (!id || typeof id !== 'string') {
    return { valid: false, status: 'pending' };
  }

  if (isAgeCheckerTestMode() && id.startsWith('test-verify-')) {
    return { valid: true, status: 'pass', verifiedAt: new Date() };
  }

  const apiKey = process.env.AGECHECKER_API_KEY;
  if (!apiKey) {
    return { valid: false, status: 'pending' };
  }

  const base = process.env.AGECHECKER_API_BASE ?? DEFAULT_API_BASE;
  const url = `${base}${VERIFICATION_PATH}/${encodeURIComponent(id)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      // never cache — verification lookups are point-in-time
      cache: 'no-store',
    });
  } catch {
    return { valid: false, status: 'pending' };
  }

  if (!res.ok) {
    return { valid: false, status: 'pending' };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { valid: false, status: 'pending' };
  }

  if (!body || typeof body !== 'object') {
    return { valid: false, status: 'pending' };
  }

  // AgeChecker's response shape may wrap the record in `data` or `verification`.
  // Accept either the top-level object or a wrapper key.
  const record = (
    'data' in body && typeof (body as Record<string, unknown>).data === 'object'
      ? (body as Record<string, unknown>).data
      : 'verification' in body &&
          typeof (body as Record<string, unknown>).verification === 'object'
        ? (body as Record<string, unknown>).verification
        : body
  ) as Record<string, unknown>;

  const status = normalizeStatus(record.status);
  const verifiedAt =
    parseDate(record.verified_at) ??
    parseDate(record.verifiedAt) ??
    parseDate(record.completed_at);
  const customerEmail =
    typeof record.email === 'string'
      ? record.email
      : typeof record.customer_email === 'string'
        ? record.customer_email
        : undefined;

  return {
    valid: status === 'pass',
    status,
    verifiedAt,
    customerEmail,
  };
}
