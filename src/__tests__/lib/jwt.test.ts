import { describe, expect, it } from 'vitest';
import { decodeJwtPayload } from '@/lib/jwt';

/** Build a minimal JWT string from a payload object (no real signature). */
function buildJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe('decodeJwtPayload', () => {
  it('returns parsed payload object from a valid JWT string', () => {
    const jwt = buildJwt({ uid: 'abc', role: 'staff' });
    const result = decodeJwtPayload(jwt);
    expect(result).toEqual(
      expect.objectContaining({ uid: 'abc', role: 'staff' })
    );
  });

  it('returns null for a malformed base64 string without throwing', () => {
    const result = decodeJwtPayload('not.valid.jwt!!!');
    expect(result).toBeNull();
  });

  it('returns null for an empty string without throwing', () => {
    const result = decodeJwtPayload('');
    expect(result).toBeNull();
  });

  it('returns null for a JWT with only one segment', () => {
    const result = decodeJwtPayload('onlyone');
    expect(result).toBeNull();
  });

  it('returns null when payload segment is valid base64 but not JSON', () => {
    const garbage = btoa('not-json');
    const result = decodeJwtPayload(`header.${garbage}.sig`);
    expect(result).toBeNull();
  });
});
