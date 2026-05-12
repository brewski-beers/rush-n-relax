import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeStatus,
  verifyAgeCheckerSignature,
  verifyVerificationId,
} from '@/lib/agechecker';

const ORIGINAL_ENV = { ...process.env };

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('normalizeStatus', () => {
  it.each([
    ['accepted', 'pass'],
    ['pass', 'pass'],
    ['approved', 'pass'],
    ['denied', 'deny'],
    ['deny', 'deny'],
    ['rejected', 'deny'],
    ['underage', 'underage'],
    ['manual_review', 'manual_review'],
    ['signature', 'pending'],
    ['photo_id', 'pending'],
    ['phone_validation', 'pending'],
    ['sms_sent', 'pending'],
    ['pending', 'pending'],
    ['something-unknown', 'pending'],
  ] as const)('maps %s → %s', (raw, expected) => {
    expect(normalizeStatus(raw)).toBe(expected);
  });

  it('returns pending for non-string input', () => {
    expect(normalizeStatus(undefined)).toBe('pending');
    expect(normalizeStatus(42)).toBe('pending');
  });
});

describe('verifyVerificationId', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AGECHECKER_TEST_MODE;
    process.env.AGECHECKER_SECRET = 'acct-secret';
    process.env.AGECHECKER_API_KEY = 'domain-key';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns valid:false for empty id', async () => {
    const result = await verifyVerificationId('');
    expect(result.valid).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns valid:false when the account secret is missing', async () => {
    delete process.env.AGECHECKER_SECRET;
    const result = await verifyVerificationId('abc-123');
    expect(result.valid).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('test mode bypass: accepts test-verify-* ids without network call', async () => {
    setEnv({ AGECHECKER_TEST_MODE: 'true' });
    const result = await verifyVerificationId('test-verify-abc');
    expect(result.valid).toBe(true);
    expect(result.status).toBe('pass');
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('test mode: still hits network for non-test-verify ids', async () => {
    setEnv({ AGECHECKER_TEST_MODE: 'true' });
    fetchMock.mockResolvedValue(jsonResponse({ status: 'accepted' }));
    const result = await verifyVerificationId('real-id-123');
    expect(fetchMock).toHaveBeenCalled();
    expect(result.valid).toBe(true);
  });

  it('returns valid:true for status=accepted and reads verification.completed_at + buyer.email', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'accepted',
        verification: {
          buyer: { email: 'buyer@example.com' },
          created: '2026-05-04T11:00:00Z',
          completed_at: '2026-05-04T12:00:00Z',
        },
        metadata: { order: 'sess_42' },
      })
    );
    const result = await verifyVerificationId('uuid-abc');
    expect(result.valid).toBe(true);
    expect(result.status).toBe('pass');
    expect(result.verifiedAt?.toISOString()).toBe('2026-05-04T12:00:00.000Z');
    expect(result.customerEmail).toBe('buyer@example.com');
    expect(result.metadata).toEqual({ order: 'sess_42' });
  });

  it('falls back to verification.created when completed_at is absent', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'accepted',
        verification: { created: '2026-05-04T11:00:00Z' },
      })
    );
    const result = await verifyVerificationId('uuid-abc');
    expect(result.verifiedAt?.toISOString()).toBe('2026-05-04T11:00:00.000Z');
  });

  it.each([
    ['denied', 'deny'],
    ['underage', 'underage'],
    ['pending', 'pending'],
    ['signature', 'pending'],
    ['photo_id', 'pending'],
  ] as const)(
    'returns valid:false for non-accepted status %s',
    async (raw, expected) => {
      fetchMock.mockResolvedValue(jsonResponse({ status: raw }));
      const result = await verifyVerificationId('uuid');
      expect(result.valid).toBe(false);
      expect(result.status).toBe(expected);
    }
  );

  it('does not throw on network error — returns valid:false', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const result = await verifyVerificationId('uuid');
    expect(result.valid).toBe(false);
    expect(result.status).toBe('pending');
  });

  it('does not throw on non-2xx response — returns valid:false', async () => {
    fetchMock.mockResolvedValue(new Response('not found', { status: 404 }));
    const result = await verifyVerificationId('uuid');
    expect(result.valid).toBe(false);
  });

  it('does not throw on malformed JSON — returns valid:false', async () => {
    fetchMock.mockResolvedValue(
      new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const result = await verifyVerificationId('uuid');
    expect(result.valid).toBe(false);
  });

  it('sends X-AgeChecker-Secret (and optional X-AgeChecker-Key) headers', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'accepted' }));
    await verifyVerificationId('uuid-xyz');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-AgeChecker-Secret']).toBe('acct-secret');
    expect(init.headers['X-AgeChecker-Key']).toBe('domain-key');
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('omits X-AgeChecker-Key when AGECHECKER_API_KEY is unset', async () => {
    delete process.env.AGECHECKER_API_KEY;
    fetchMock.mockResolvedValue(jsonResponse({ status: 'accepted' }));
    await verifyVerificationId('uuid-xyz');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-AgeChecker-Key']).toBeUndefined();
    expect(init.headers['X-AgeChecker-Secret']).toBe('acct-secret');
  });

  it('hits AGECHECKER_API_BASE override on the /v1/status path when set', async () => {
    setEnv({ AGECHECKER_API_BASE: 'https://staging.agechecker.example' });
    fetchMock.mockResolvedValue(jsonResponse({ status: 'accepted' }));
    await verifyVerificationId('uuid-xyz');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://staging.agechecker.example/v1/status/uuid-xyz');
  });

  it('defaults to https://api.agechecker.net/v1/status/{uuid}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'accepted' }));
    await verifyVerificationId('uuid-xyz');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.agechecker.net/v1/status/uuid-xyz');
  });

  it('url-encodes the id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'accepted' }));
    await verifyVerificationId('weird id/with/slashes');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('weird%20id%2Fwith%2Fslashes');
  });
});

describe('createAgeCheckerSession', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AGECHECKER_TEST_MODE;
    process.env.AGECHECKER_API_KEY = 'domain-key';
    process.env.AGECHECKER_SECRET = 'acct-secret';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it('test mode returns a stub session without network call', async () => {
    setEnv({ AGECHECKER_TEST_MODE: 'true' });
    const { createAgeCheckerSession } = await import('@/lib/agechecker');
    const res = await createAgeCheckerSession({
      checkoutSessionId: 'sess_1',
      callbackUrl: 'https://example.com/api/webhooks/agechecker',
    });
    expect(res.sessionUuid).toMatch(/^test-session-/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs key+secret with options.{callback_url,metadata,contact_customer} and returns uuid', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ uuid: 'ac-uuid-99' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    );
    const { createAgeCheckerSession } = await import('@/lib/agechecker');
    const res = await createAgeCheckerSession({
      checkoutSessionId: 'sess_42',
      callbackUrl: 'https://rushnrelax.com/api/webhooks/agechecker',
      customerEmail: 'buyer@example.com',
    });
    expect(res.sessionUuid).toBe('ac-uuid-99');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.agechecker.net/v1/session/create');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      key: 'domain-key',
      secret: 'acct-secret',
      flow_type: 'default',
      options: {
        contact_customer: false,
        callback_url: 'https://rushnrelax.com/api/webhooks/agechecker',
        metadata: { order: 'sess_42' },
        email: 'buyer@example.com',
      },
    });
    // No Bearer auth — auth is the key/secret body fields.
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('does not include email under options when no customerEmail is given', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ uuid: 'u' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const { createAgeCheckerSession } = await import('@/lib/agechecker');
    await createAgeCheckerSession({
      checkoutSessionId: 's',
      callbackUrl: 'https://x.test/cb',
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.options.email).toBeUndefined();
  });

  it('accepts session_uuid or id as alternate response field names', async () => {
    const { createAgeCheckerSession } = await import('@/lib/agechecker');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ session_uuid: 'alt-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const r1 = await createAgeCheckerSession({
      checkoutSessionId: 's',
      callbackUrl: 'https://x.test/cb',
    });
    expect(r1.sessionUuid).toBe('alt-1');

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'alt-2' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const r2 = await createAgeCheckerSession({
      checkoutSessionId: 's',
      callbackUrl: 'https://x.test/cb',
    });
    expect(r2.sessionUuid).toBe('alt-2');
  });

  it('throws on non-2xx response and surfaces error.code + error.message', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'invalid_key', message: 'Bad domain key' },
        }),
        {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
        }
      )
    );
    const { createAgeCheckerSession } = await import('@/lib/agechecker');
    await expect(
      createAgeCheckerSession({
        checkoutSessionId: 's',
        callbackUrl: 'https://x.test/cb',
      })
    ).rejects.toThrow(
      /session\/create failed: 400.*invalid_key.*Bad domain key/
    );
  });

  it('throws when AGECHECKER_API_KEY (domain key) is missing', async () => {
    delete process.env.AGECHECKER_API_KEY;
    const { createAgeCheckerSession } = await import('@/lib/agechecker');
    await expect(
      createAgeCheckerSession({
        checkoutSessionId: 's',
        callbackUrl: 'https://x.test/cb',
      })
    ).rejects.toThrow(/AGECHECKER_API_KEY/);
  });

  it('throws when AGECHECKER_SECRET (account secret) is missing', async () => {
    delete process.env.AGECHECKER_SECRET;
    const { createAgeCheckerSession } = await import('@/lib/agechecker');
    await expect(
      createAgeCheckerSession({
        checkoutSessionId: 's',
        callbackUrl: 'https://x.test/cb',
      })
    ).rejects.toThrow(/AGECHECKER_SECRET/);
  });

  it('throws when callbackUrl is not absolute', async () => {
    const { createAgeCheckerSession } = await import('@/lib/agechecker');
    await expect(
      createAgeCheckerSession({
        checkoutSessionId: 's',
        callbackUrl: '/api/webhooks/agechecker',
      })
    ).rejects.toThrow(/callbackUrl must be an absolute/);
  });

  it('throws when response is missing all known uuid field names', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ unrelated: 'x' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const { createAgeCheckerSession } = await import('@/lib/agechecker');
    await expect(
      createAgeCheckerSession({
        checkoutSessionId: 's',
        callbackUrl: 'https://x.test/cb',
      })
    ).rejects.toThrow(/missing session id/);
  });
});

describe('verifyAgeCheckerSignature (HMAC-SHA1 / base64)', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AGECHECKER_TEST_MODE;
    process.env.AGECHECKER_SECRET = 'acct-secret';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function sign(body: string, secret = 'acct-secret'): string {
    return crypto.createHmac('sha1', secret).update(body).digest('base64');
  }

  it('accepts a base64 HMAC-SHA1 over the raw body', () => {
    const raw = '{"uuid":"v1","status":"accepted"}';
    expect(verifyAgeCheckerSignature(raw, sign(raw))).toBe(true);
  });

  it('accepts a signature computed over the re-stringified parsed body', () => {
    // AgeChecker's NodeJS example keys over JSON.stringify(parsedBody);
    // the bytes we receive may have different whitespace.
    const raw = '{ "uuid": "v1",  "status": "accepted" }';
    const restringified = JSON.stringify(JSON.parse(raw));
    expect(verifyAgeCheckerSignature(raw, sign(restringified))).toBe(true);
  });

  it('rejects a SHA256/hex signature (the old, wrong scheme)', () => {
    const raw = '{"uuid":"v1"}';
    const wrong = crypto
      .createHmac('sha256', 'acct-secret')
      .update(raw)
      .digest('hex');
    expect(verifyAgeCheckerSignature(raw, wrong)).toBe(false);
  });

  it('rejects when the signature was keyed with the wrong secret', () => {
    const raw = '{"uuid":"v1"}';
    expect(verifyAgeCheckerSignature(raw, sign(raw, 'not-the-secret'))).toBe(
      false
    );
  });

  it('rejects a missing signature header', () => {
    expect(verifyAgeCheckerSignature('{}', null)).toBe(false);
  });

  it('rejects when AGECHECKER_SECRET is unset', () => {
    delete process.env.AGECHECKER_SECRET;
    const raw = '{"uuid":"v1"}';
    expect(verifyAgeCheckerSignature(raw, sign(raw))).toBe(false);
  });

  it('bypasses verification in test mode', () => {
    process.env.AGECHECKER_TEST_MODE = 'true';
    expect(verifyAgeCheckerSignature('anything', null)).toBe(true);
  });
});

describe('resolveAgeCheckerCallbackBase', () => {
  const SAVED = { ...process.env };
  afterEach(() => {
    process.env = { ...SAVED };
  });

  it('prefers SITE_URL when set', async () => {
    process.env.SITE_URL = 'https://rushnrelax.com';
    delete process.env.VERCEL_URL;
    const { resolveAgeCheckerCallbackBase } = await import('@/lib/agechecker');
    expect(resolveAgeCheckerCallbackBase()).toBe('https://rushnrelax.com');
  });

  it('falls back to https://VERCEL_URL for preview deployments', async () => {
    delete process.env.SITE_URL;
    process.env.VERCEL_URL = 'rnr-pr-123.vercel.app';
    const { resolveAgeCheckerCallbackBase } = await import('@/lib/agechecker');
    expect(resolveAgeCheckerCallbackBase()).toBe(
      'https://rnr-pr-123.vercel.app'
    );
  });

  it('throws when neither SITE_URL nor VERCEL_URL is set', async () => {
    delete process.env.SITE_URL;
    delete process.env.VERCEL_URL;
    const { resolveAgeCheckerCallbackBase } = await import('@/lib/agechecker');
    expect(() => resolveAgeCheckerCallbackBase()).toThrow(/Cannot resolve/);
  });
});
