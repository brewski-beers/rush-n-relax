import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyVerificationId } from '@/lib/agechecker';

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

describe('verifyVerificationId', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AGECHECKER_TEST_MODE;
    process.env.AGECHECKER_API_KEY = 'test-key';
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

  it('returns valid:false when API key is missing', async () => {
    delete process.env.AGECHECKER_API_KEY;
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
    fetchMock.mockResolvedValue(jsonResponse({ status: 'pass' }));
    const result = await verifyVerificationId('real-id-123');
    expect(fetchMock).toHaveBeenCalled();
    expect(result.valid).toBe(true);
  });

  it('returns valid:true for status=pass', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'pass',
        verified_at: '2026-05-04T12:00:00Z',
        email: 'buyer@example.com',
      })
    );
    const result = await verifyVerificationId('uuid-abc');
    expect(result.valid).toBe(true);
    expect(result.status).toBe('pass');
    expect(result.verifiedAt?.toISOString()).toBe('2026-05-04T12:00:00.000Z');
    expect(result.customerEmail).toBe('buyer@example.com');
  });

  it('unwraps a {data: {...}} envelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { status: 'pass', email: 'a@b.co' } })
    );
    const result = await verifyVerificationId('uuid-abc');
    expect(result.valid).toBe(true);
    expect(result.customerEmail).toBe('a@b.co');
  });

  it('unwraps a {verification: {...}} envelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ verification: { status: 'pass' } })
    );
    const result = await verifyVerificationId('uuid-abc');
    expect(result.valid).toBe(true);
  });

  it.each([
    ['deny', 'deny'],
    ['underage', 'underage'],
    ['pending', 'pending'],
    ['manual_review', 'manual_review'],
  ] as const)(
    'returns valid:false for non-pass status %s',
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
    fetchMock.mockResolvedValue(
      new Response('not found', { status: 404 })
    );
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

  it('sends Authorization: Bearer header with API key', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'pass' }));
    await verifyVerificationId('uuid-xyz');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer test-key');
  });

  it('hits AGECHECKER_API_BASE override when set', async () => {
    setEnv({ AGECHECKER_API_BASE: 'https://staging.agechecker.example' });
    fetchMock.mockResolvedValue(jsonResponse({ status: 'pass' }));
    await verifyVerificationId('uuid-xyz');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://staging.agechecker.example/api/verification/uuid-xyz'
    );
  });

  it('defaults to https://api.agechecker.net', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'pass' }));
    await verifyVerificationId('uuid-xyz');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.agechecker.net/api/verification/uuid-xyz');
  });

  it('url-encodes the id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'pass' }));
    await verifyVerificationId('weird id/with/slashes');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('weird%20id%2Fwith%2Fslashes');
  });
});
