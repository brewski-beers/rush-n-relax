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
const SESSION_CREATE_PATH = '/v1/session/create';

export interface CreateAgeCheckerSessionInput {
  /** Our CheckoutSession id. Bound to AgeChecker `metadata.order`. */
  checkoutSessionId: string;
  /**
   * Absolute URL AgeChecker will POST verification results to. Must be
   * publicly reachable HTTPS; we throw if the caller supplies a relative
   * or empty value.
   */
  callbackUrl: string;
  customerEmail?: string;
}

export interface CreateAgeCheckerSessionResult {
  /** AgeChecker-issued session UUID — passed to the popup as `session`. */
  sessionUuid: string;
}

/**
 * Create an AgeChecker verification session server-side. This is the ONLY
 * way to register a `callback_url` + `metadata.order` with AgeChecker —
 * the browser-side `AgeCheckerConfig` object does not accept those keys.
 *
 * Test mode: when `AGECHECKER_TEST_MODE=true`, returns a stub UUID
 * without a network call. Mirrors the pattern in `verifyVerificationId`.
 *
 * Endpoint: `POST {AGECHECKER_API_BASE}/v1/session/create`
 * Auth:     `Authorization: Bearer {AGECHECKER_API_KEY}`
 *
 * Response shape is defensively decoded — AgeChecker docs reference
 * `uuid` but related endpoints have used `session_uuid` / `id` in the
 * wild, so we accept any of the three.
 */
export async function createAgeCheckerSession(
  input: CreateAgeCheckerSessionInput
): Promise<CreateAgeCheckerSessionResult> {
  if (!input.checkoutSessionId) {
    throw new Error('checkoutSessionId is required');
  }
  if (!input.callbackUrl || !/^https?:\/\//.test(input.callbackUrl)) {
    throw new Error(
      `callbackUrl must be an absolute http(s) URL — got '${input.callbackUrl}'`
    );
  }

  if (isAgeCheckerTestMode()) {
    const stub = `test-session-${crypto.randomBytes(8).toString('hex')}`;
    return { sessionUuid: stub };
  }

  const apiKey = process.env.AGECHECKER_API_KEY;
  if (!apiKey) {
    throw new Error('AGECHECKER_API_KEY is not set');
  }

  const base = process.env.AGECHECKER_API_BASE ?? DEFAULT_API_BASE;
  const url = `${base}${SESSION_CREATE_PATH}`;

  const body = {
    callback_url: input.callbackUrl,
    metadata: { order: input.checkoutSessionId },
    contact_customer: false,
    ...(input.customerEmail ? { email: input.customerEmail } : {}),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `AgeChecker session/create failed: ${res.status} ${res.statusText} ${text}`
    );
  }

  const parsed: unknown = await res.json().catch(() => null);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AgeChecker session/create returned non-JSON body');
  }

  // Unwrap `data` / `session` wrapper if present.
  const record = (
    'data' in parsed &&
    typeof (parsed as Record<string, unknown>).data === 'object'
      ? (parsed as Record<string, unknown>).data
      : 'session' in parsed &&
          typeof (parsed as Record<string, unknown>).session === 'object'
        ? (parsed as Record<string, unknown>).session
        : parsed
  ) as Record<string, unknown>;

  const sessionUuid =
    typeof record.uuid === 'string'
      ? record.uuid
      : typeof record.session_uuid === 'string'
        ? record.session_uuid
        : typeof record.id === 'string'
          ? record.id
          : null;

  if (!sessionUuid) {
    console.error(
      '[agechecker] session/create response missing uuid/session_uuid/id',
      parsed
    );
    throw new Error('AgeChecker session/create response missing session id');
  }

  return { sessionUuid };
}

/**
 * Resolve the absolute base URL used for the AgeChecker callback. Prefers
 * `SITE_URL` (set per Vercel env); falls back to `https://${VERCEL_URL}`
 * for preview deployments where `SITE_URL` is not explicitly configured.
 * Throws if neither is available — calls must not silently default to
 * production.
 */
export function resolveAgeCheckerCallbackBase(): string {
  const siteUrl = process.env.SITE_URL;
  if (siteUrl && /^https?:\/\//.test(siteUrl)) {
    return siteUrl.replace(/\/$/, '');
  }
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, '')}`;
  }
  throw new Error(
    'Cannot resolve AgeChecker callback base — set SITE_URL or VERCEL_URL'
  );
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
