import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CloverApiError, createCloverCheckoutSession } from './checkout';

const ENV_KEYS = [
  'CLOVER_MERCHANT_ID',
  'CLOVER_API_KEY',
  'CLOVER_BASE_URL',
  'VERCEL_URL',
  'NEXT_PUBLIC_SITE_URL',
] as const;

const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k];
  }
  vi.restoreAllMocks();
});

describe('createCloverCheckoutSession', () => {
  it('returns a stub session when env vars are missing', async () => {
    delete process.env.CLOVER_MERCHANT_ID;
    delete process.env.CLOVER_API_KEY;
    delete process.env.CLOVER_BASE_URL;

    const session = await createCloverCheckoutSession({
      orderId: 'order-1',
      amount: 1500,
      lineItems: [{ name: 'Hat', quantity: 1, unitPrice: 1500 }],
    });

    expect(session.provider).toBe('stub');
    expect(session.redirectUrl).toBe('/checkout/stub?order=order-1');
    expect(session.sessionId).toBe('stub-order-1');
  });

  it('POSTs to Clover and returns the hosted href on success', async () => {
    process.env.CLOVER_MERCHANT_ID = 'FFG76YKEA9QK1';
    process.env.CLOVER_API_KEY = 'test-token';
    process.env.CLOVER_BASE_URL = 'https://apisandbox.dev.clover.com';
    process.env.VERCEL_URL = 'rush-n-relax-preview.vercel.app';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          href: 'https://checkout.sandbox.dev.clover.com/c/abc123',
          checkoutSessionId: 'CHK_ABC123',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await createCloverCheckoutSession({
      orderId: 'order-42',
      amount: 3000,
      customerEmail: 'kb@example.com',
      lineItems: [{ name: 'Hoodie', quantity: 2, unitPrice: 1500 }],
    });

    expect(session.provider).toBe('clover');
    expect(session.redirectUrl).toBe(
      'https://checkout.sandbox.dev.clover.com/c/abc123'
    );
    expect(session.sessionId).toBe('CHK_ABC123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(
      'https://apisandbox.dev.clover.com/invoicingcheckoutservice/v1/checkouts'
    );
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(headers['X-Clover-Merchant-Id']).toBe('FFG76YKEA9QK1');
    const body = JSON.parse(init.body as string) as {
      customer: { email: string };
      shoppingCart: {
        lineItems: Array<{ name: string; unitQty: number; price: number }>;
      };
      redirectUrl: string;
    };
    expect(body.customer.email).toBe('kb@example.com');
    expect(body.shoppingCart.lineItems).toEqual([
      { name: 'Hoodie', unitQty: 2, price: 1500 },
    ]);
    expect(body.redirectUrl).toBe(
      'https://rush-n-relax-preview.vercel.app/order/order-42/return'
    );
  });

  it('throws CloverApiError on non-2xx response', async () => {
    process.env.CLOVER_MERCHANT_ID = 'M';
    process.env.CLOVER_API_KEY = 'k';
    process.env.CLOVER_BASE_URL = 'https://apisandbox.dev.clover.com';

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createCloverCheckoutSession({
        orderId: 'order-x',
        amount: 100,
        lineItems: [{ name: 'X', quantity: 1, unitPrice: 100 }],
      })
    ).rejects.toBeInstanceOf(CloverApiError);
  });
});
