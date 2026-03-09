import { describe, it, expect, vi } from 'vitest';
import { withComplianceGuard } from '@/lib/compliance/api-guard';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('withComplianceGuard', () => {
  it('calls handler when no tier-1 violations', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const guarded = withComplianceGuard(handler, [
      { field: 'description', context: 'product' },
    ]);

    const req = makeRequest({
      description: 'Premium hemp flower available in-store.',
    });
    const res = await guarded(req);

    expect(handler).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it('returns 422 and does not call handler when tier-1 violation present', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const guarded = withComplianceGuard(handler, [
      { field: 'description', context: 'product' },
    ]);

    const req = makeRequest({
      description: 'This product treats chronic pain.',
    });
    const res = await guarded(req);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/compliance/i);
    expect(body.violations).toBeInstanceOf(Array);
    expect(body.violations[0].tier).toBe(1);
  });

  it('calls handler when tier-2 violation present (not blocked)', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const guarded = withComplianceGuard(handler, [
      { field: 'description', context: 'product' },
    ]);

    const req = makeRequest({
      description: 'Great for stress relief and wellness.',
    });
    const res = await guarded(req);

    expect(handler).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it('checks all specified fields', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const guarded = withComplianceGuard(handler, [
      { field: 'title', context: 'seo-title' },
      { field: 'description', context: 'seo-description' },
    ]);

    const req = makeRequest({
      title: 'Clean title',
      description: 'This cures everything.',
    });
    const res = await guarded(req);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(422);
  });

  it('skips fields not present in the body', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const guarded = withComplianceGuard(handler, [
      { field: 'description', context: 'product' },
    ]);

    // body has no 'description' field
    const req = makeRequest({ name: 'Product Name' });
    const res = await guarded(req);

    expect(handler).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it('skips non-string field values', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const guarded = withComplianceGuard(handler, [
      { field: 'description', context: 'product' },
    ]);

    const req = makeRequest({ description: 42 });
    await guarded(req);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('calls handler when body is not valid JSON', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const guarded = withComplianceGuard(handler, [
      { field: 'description', context: 'product' },
    ]);

    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: 'not-json',
    });
    const res = await guarded(req);

    expect(handler).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });
});
