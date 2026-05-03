import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CloverApiError,
  createCloverCheckoutSession,
} from '@/lib/clover/checkout';

const ORIGINAL_ENV = { ...process.env };

function setEnv(patch: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('createCloverCheckoutSession — kill switch behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CLOVER_LIVE_PAYMENTS_ENABLED;
    delete process.env.CLOVER_MERCHANT_ID;
    delete process.env.CLOVER_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns the stub when kill switch is OFF even if prod creds are present', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: undefined,
      CLOVER_MERCHANT_ID: 'M_PROD',
      CLOVER_API_KEY: 'K_PROD',
    });
    const fetchSpy = vi.spyOn(global, 'fetch');
    const res = await createCloverCheckoutSession({
      orderId: 'ord_1',
      amount: 1000,
    });
    expect(res.provider).toBe('stub');
    expect(res.redirectUrl).toContain('/checkout/stub');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns the stub when kill switch is ON but credentials are absent', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: 'true',
      CLOVER_MERCHANT_ID: undefined,
      CLOVER_API_KEY: undefined,
    });
    const fetchSpy = vi.spyOn(global, 'fetch');
    const res = await createCloverCheckoutSession({
      orderId: 'ord_2',
      amount: 1000,
    });
    expect(res.provider).toBe('stub');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls the real Clover API when kill switch ON + credentials present', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: 'true',
      CLOVER_MERCHANT_ID: 'M_PROD',
      CLOVER_API_KEY: 'K_PROD',
      VERCEL_URL: 'rushnrelax.com',
    });
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          href: 'https://clover.com/checkout/abc',
          checkoutSessionId: 'sess_abc',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    const res = await createCloverCheckoutSession({
      orderId: 'ord_3',
      amount: 1500,
      customerEmail: 'buyer@example.com',
      items: [
        {
          productId: 'p1',
          productName: 'Widget',
          quantity: 2,
          unitPrice: 750,
          lineTotal: 1500,
        },
      ],
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/invoicingcheckoutservice/v1/checkouts');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer K_PROD');
    const body = JSON.parse(init.body as string) as {
      customer?: { email: string };
      shoppingCart: {
        lineItems: Array<{ name: string; unitQty: number; price: number }>;
      };
      redirectUrl: string;
    };
    expect(body.customer?.email).toBe('buyer@example.com');
    expect(body.shoppingCart.lineItems).toEqual([
      { name: 'Widget', unitQty: 2, price: 750 },
    ]);
    expect(body.redirectUrl).toBe('https://rushnrelax.com/order/ord_3');
    expect(res.provider).toBe('clover');
    expect(res.redirectUrl).toBe('https://clover.com/checkout/abc');
    expect(res.cloverCheckoutSessionId).toBe('sess_abc');
  });

  it('throws CloverApiError on non-2xx Clover response', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: 'true',
      CLOVER_MERCHANT_ID: 'M_PROD',
      CLOVER_API_KEY: 'K_PROD',
    });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('forbidden', { status: 403 })
    );
    await expect(
      createCloverCheckoutSession({ orderId: 'ord_4', amount: 1000 })
    ).rejects.toBeInstanceOf(CloverApiError);
  });
});
