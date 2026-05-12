/**
 * AgeChecker.Net integration helpers.
 *
 * The customer-facing verification flow runs in the browser via the
 * AgeChecker popup widget (see `verify/VerifyClient.tsx` /
 * `components/AgeCheckerGuard/`). The popup inherits the `callback_url` +
 * `metadata.order` registered on a server-created session
 * (`POST /v1/session/create`), so the verification result is delivered to
 * our webhook (`PUT /api/webhooks/agechecker`) rather than via any JS
 * callback.
 *
 * Server-side, this module owns:
 *   - session creation (`createAgeCheckerSession`)
 *   - inbound webhook signature auth (`verifyAgeCheckerSignature`)
 *   - server-side session-status lookup (`verifyVerificationId`) — both
 *     defense-in-depth before trusting a webhook payload AND the only way
 *     to recover our CheckoutSession id (the callback body carries no
 *     `metadata`).
 *
 * Auth model (per AgeChecker docs — NOT Bearer):
 *   - `AGECHECKER_API_KEY`  → domain API key  → `key` body field / `X-AgeChecker-Key`
 *   - `AGECHECKER_SECRET`   → account secret  → `secret` body field / `X-AgeChecker-Secret`
 *
 * Test mode: when `AGECHECKER_TEST_MODE=true`, the webhook handler accepts
 * unsigned payloads, `verifyVerificationId` accepts ids matching
 * `test-verify-*`, and `createAgeCheckerSession` returns a stub uuid — all
 * without a network call.
 *
 * Dashboard: https://agechecker.net
 */
import crypto from 'node:crypto';

/**
 * Internal normalized verification status. AgeChecker's wire statuses
 * (`accepted`, `denied`, `signature`, `photo_id`, `phone_validation`,
 * `sms_sent`, `pending`, …) are folded into these five by `normalizeStatus`.
 * The intermediate step-up statuses (`signature`/`photo_id`/…) all map to
 * `pending` — the customer must do more, but the session is not terminal.
 */
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
  /**
   * The `metadata` object echoed back by `GET /v1/status/{uuid}`. Carries
   * `metadata.order` — our CheckoutSession id — which is the only way the
   * webhook handler can resolve the session (the callback body has no
   * metadata). Only present when the request was made with the account
   * secret header.
   */
  metadata?: Record<string, unknown>;
}

const DEFAULT_API_BASE = 'https://api.agechecker.net';
const STATUS_PATH = '/v1/status'; // GET {base}{path}/{uuid}
const SESSION_CREATE_PATH = '/v1/session/create';

export interface CreateAgeCheckerSessionInput {
  /** Our CheckoutSession id. Bound to AgeChecker `options.metadata.order`. */
  checkoutSessionId: string;
  /**
   * Absolute URL AgeChecker will PUT verification results to. Must be
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

function getApiBase(): string {
  return process.env.AGECHECKER_API_BASE ?? DEFAULT_API_BASE;
}

/**
 * Parse an AgeChecker `{ error: { code, message } }` body out of an error
 * response so the thrown Error is diagnosable. Falls back to the raw text.
 */
async function describeErrorResponse(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof (parsed as Record<string, unknown>).error === 'object' &&
      (parsed as Record<string, unknown>).error !== null
    ) {
      const err = (parsed as { error: Record<string, unknown> }).error;
      const code = typeof err.code === 'string' ? err.code : 'unknown';
      const message =
        typeof err.message === 'string' ? err.message : '(no message)';
      return `code=${code} message=${message}`;
    }
  } catch {
    // not JSON — fall through to raw text
  }
  return text || '(empty body)';
}

/**
 * Create an AgeChecker verification session server-side. This is the ONLY
 * way to register a `callback_url` + `metadata.order` with AgeChecker —
 * the browser-side `AgeCheckerConfig` object does not accept those keys.
 *
 * Test mode: when `AGECHECKER_TEST_MODE=true`, returns a stub UUID
 * without a network call.
 *
 * Endpoint: `POST {AGECHECKER_API_BASE}/v1/session/create`
 * Auth:     `key` + `secret` in the JSON body (NOT `Authorization: Bearer`).
 * Body:
 *   {
 *     key, secret, flow_type: "default",
 *     options: { contact_customer, callback_url, metadata: { order } }
 *   }
 *
 * Response: `{ "uuid": "<session uuid>", ... }`. The defensive unwrap of a
 * `data` / `session` envelope is retained; `uuid` is the documented name.
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

  const key = process.env.AGECHECKER_API_KEY;
  const secret = process.env.AGECHECKER_SECRET;
  if (!key) {
    throw new Error('AGECHECKER_API_KEY (domain key) is not set');
  }
  if (!secret) {
    throw new Error('AGECHECKER_SECRET (account secret) is not set');
  }

  const url = `${getApiBase()}${SESSION_CREATE_PATH}`;

  const body = {
    key,
    secret,
    flow_type: 'default',
    options: {
      contact_customer: false,
      callback_url: input.callbackUrl,
      metadata: { order: input.checkoutSessionId },
      ...(input.customerEmail ? { email: input.customerEmail } : {}),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const detail = await describeErrorResponse(res);
    throw new Error(
      `AgeChecker session/create failed: ${res.status} ${res.statusText} — ${detail}`
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
 *
 * Per AgeChecker's NodeJS example, the `X-AgeChecker-Signature` header is
 * the base64-encoded HMAC-SHA1 of the request body, keyed with the account
 * secret (`AGECHECKER_SECRET`). To be robust against whitespace/key-order
 * differences between the bytes we received and the bytes they hashed, we
 * accept a match against EITHER the raw request body OR the re-stringified
 * parsed body.
 *
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

  const candidates: string[] = [rawBody];
  try {
    candidates.push(JSON.stringify(JSON.parse(rawBody)));
  } catch {
    // rawBody is not JSON — only the raw candidate applies
  }

  let provided: Buffer;
  try {
    provided = Buffer.from(signatureHeader, 'base64');
  } catch {
    return false;
  }
  if (provided.length === 0) return false;

  for (const candidate of candidates) {
    const expected = crypto
      .createHmac('sha1', secret)
      .update(candidate)
      .digest(); // Buffer
    if (
      provided.length === expected.length &&
      crypto.timingSafeEqual(provided, expected)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Fold an AgeChecker wire status into our internal `AgeCheckStatus`.
 *
 * AgeChecker statuses:
 *   - `accepted`            → `pass`   (terminal success)
 *   - `denied`              → `deny`   (terminal failure)
 *   - `signature` / `photo_id` / `phone_validation` / `sms_sent` / `pending`
 *                           → `pending` (non-terminal step-up — do NOT cancel)
 * Legacy synonyms (`passed`/`approved`/`verified`, `rejected`/`fail`, etc.)
 * are kept for resilience against doc drift.
 */
export function normalizeStatus(raw: unknown): AgeCheckStatus {
  if (typeof raw !== 'string') return 'pending';
  const v = raw.toLowerCase();
  switch (v) {
    case 'accepted':
    case 'pass':
    case 'passed':
    case 'approved':
    case 'verified':
      return 'pass';
    case 'denied':
    case 'deny':
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
    case 'signature':
    case 'photo_id':
    case 'phone_validation':
    case 'sms_sent':
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
 * Server-side lookup of an AgeChecker verification/session uuid via
 * `GET /v1/status/{uuid}`. Used both as defense in depth before trusting a
 * webhook payload AND to recover our CheckoutSession id from
 * `metadata.order` (the callback body carries no metadata).
 *
 * Endpoint: `GET {AGECHECKER_API_BASE}/v1/status/{uuid}`
 *   - Header `X-AgeChecker-Secret: {AGECHECKER_SECRET}` (REQUIRED to get
 *     `metadata` + `verification` back).
 *   - Header `X-AgeChecker-Key: {AGECHECKER_API_KEY}` (optional).
 *
 * Response:
 *   {
 *     status: "accepted"|"denied"|"signature"|"photo_id"|"phone_validation"
 *             |"sms_sent"|"pending",
 *     reason?: string,
 *     verification?: { buyer?: {...}, created?: string, completed_at?: string },
 *     metadata?: {...}
 *   }
 *
 * Returns `valid: true` only when `status === "accepted"`. Network errors,
 * non-2xx responses, missing config, and unknown ids all resolve to
 * `valid: false` — this function does not throw.
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

  const secret = process.env.AGECHECKER_SECRET;
  if (!secret) {
    return { valid: false, status: 'pending' };
  }

  const url = `${getApiBase()}${STATUS_PATH}/${encodeURIComponent(id)}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-AgeChecker-Secret': secret,
  };
  const key = process.env.AGECHECKER_API_KEY;
  if (key) headers['X-AgeChecker-Key'] = key;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers,
      // never cache — status lookups are point-in-time
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

  const record = body as Record<string, unknown>;
  const rawStatus = record.status;
  const status = normalizeStatus(rawStatus);

  const verification =
    record.verification && typeof record.verification === 'object'
      ? (record.verification as Record<string, unknown>)
      : undefined;

  const verifiedAt = verification
    ? (parseDate(verification.completed_at) ?? parseDate(verification.created))
    : undefined;

  const buyer =
    verification && verification.buyer && typeof verification.buyer === 'object'
      ? (verification.buyer as Record<string, unknown>)
      : undefined;
  const customerEmail =
    buyer && typeof buyer.email === 'string'
      ? buyer.email
      : typeof record.email === 'string'
        ? record.email
        : undefined;

  const metadata =
    record.metadata && typeof record.metadata === 'object'
      ? (record.metadata as Record<string, unknown>)
      : undefined;

  return {
    // Only the literal AgeChecker `accepted` status counts as valid here —
    // legacy synonyms still normalize to `pass` for status reporting, but a
    // genuine AgeChecker response uses `accepted`.
    valid:
      typeof rawStatus === 'string' && rawStatus.toLowerCase() === 'accepted',
    status,
    verifiedAt,
    customerEmail,
    metadata,
  };
}
