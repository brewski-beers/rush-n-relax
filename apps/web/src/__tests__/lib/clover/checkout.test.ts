import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CloverApiError,
  createCloverCheckoutSession,
  getCloverOrderIdForCheckout,
  getCloverPaymentForOrder,
  refundCloverPayment,
  splitCustomerName,
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
    delete process.env.CLOVER_BASE_URL;
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
      sessionId: 'ord_1',
      amount: 1000,
    });
    expect(res.provider).toBe('stub');
    expect(res.redirectUrl).toContain('/checkout/stub');
    // Stub URL must be absolute — `NextResponse.redirect()` rejects
    // relative URLs and surfaces as a 500 in preview/dev.
    expect(URL.canParse(res.redirectUrl)).toBe(true);
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
      sessionId: 'ord_2',
      amount: 1000,
    });
    expect(res.provider).toBe('stub');
    expect(URL.canParse(res.redirectUrl)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stub redirectUrl uses VERCEL_URL host with https scheme when present', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: undefined,
      VERCEL_URL: 'rnr-abc123.vercel.app',
    });
    const res = await createCloverCheckoutSession({
      sessionId: 'ord_v',
      amount: 100,
    });
    expect(res.provider).toBe('stub');
    expect(res.redirectUrl).toBe(
      'https://rnr-abc123.vercel.app/checkout/stub?order=ord_v'
    );
  });

  it('calls the real Clover API with redirectUrls built from our generated session id (no Clover template token)', async () => {
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
      sessionId: 'ord_3',
      amount: 1500,
      customerEmail: 'buyer@example.com',
      items: [
        {
          productId: 'p1',
          variantId: 'default',
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
      redirectUrl?: string;
      redirectUrls: { success: string; failure: string };
    };
    expect(body.customer?.email).toBe('buyer@example.com');
    expect(body.shoppingCart.lineItems).toEqual([
      { name: 'Widget', unitQty: 2, price: 750 },
    ]);
    // Legacy singular field must NOT be sent — Clover ignores it.
    expect(body.redirectUrl).toBeUndefined();
    // The success/failure URLs are fully resolved from the session id we
    // generated — Clover does NOT substitute the {CHECKOUT_SESSION_ID} /
    // {ERROR_CODE} tokens, so we never put them in the payload.
    expect(body.redirectUrls.success).toBe(
      'https://rushnrelax.com/order/ord_3/return'
    );
    expect(body.redirectUrls.failure).toBe(
      'https://rushnrelax.com/checkout/cancelled?session=ord_3'
    );
    expect(res.provider).toBe('clover');
    expect(res.redirectUrl).toBe('https://clover.com/checkout/abc');
    expect(res.cloverCheckoutSessionId).toBe('sess_abc');

    // Annotation: our session id is embedded as `note` so the orders-list
    // tagged lookup can find this Clover order later when /checkouts/{id}
    // 404s (the live-confirmed Clover bug).
    const bodyWithNote = body as typeof body & { note?: string };
    expect(bodyWithNote.note).toBe('ord_3');
  });

  it('appends a "Sales Tax" line item so the cart total equals the session total', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: 'true',
      CLOVER_MERCHANT_ID: 'M_PROD',
      CLOVER_API_KEY: 'K_PROD',
      VERCEL_URL: 'rushnrelax.com',
    });
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ href: 'h', checkoutSessionId: 's' }), {
        status: 200,
      })
    );
    // 2 × $10.00 = $20.00 subtotal + $1.85 tax = $21.85 total.
    await createCloverCheckoutSession({
      sessionId: 'ord_tax',
      amount: 2185,
      tax: 185,
      items: [
        {
          productId: 'p1',
          variantId: 'default',
          productName: 'Gummy',
          quantity: 2,
          unitPrice: 1000,
          lineTotal: 2000,
        },
      ],
    });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      shoppingCart: {
        lineItems: Array<{ name: string; unitQty: number; price: number }>;
      };
    };
    expect(body.shoppingCart.lineItems).toEqual([
      { name: 'Gummy', unitQty: 2, price: 1000 },
      { name: 'Sales Tax', unitQty: 1, price: 185 },
    ]);
    const cartTotal = body.shoppingCart.lineItems.reduce(
      (sum, li) => sum + li.unitQty * li.price,
      0
    );
    expect(cartTotal).toBe(2185);
  });

  it('does not add a tax line item when tax is zero or omitted', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: 'true',
      CLOVER_MERCHANT_ID: 'M_PROD',
      CLOVER_API_KEY: 'K_PROD',
    });
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ href: 'h', checkoutSessionId: 's' }), {
        status: 200,
      })
    );
    await createCloverCheckoutSession({
      sessionId: 'ord_notax',
      amount: 2000,
      tax: 0,
      items: [
        {
          productId: 'p1',
          variantId: 'default',
          productName: 'Gummy',
          quantity: 2,
          unitPrice: 1000,
          lineTotal: 2000,
        },
      ],
    });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      shoppingCart: { lineItems: Array<{ name: string }> };
    };
    expect(body.shoppingCart.lineItems.map(li => li.name)).toEqual(['Gummy']);
  });

  it('prefills the customer object with split firstName/lastName + email from deliveryAddress', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: 'true',
      CLOVER_MERCHANT_ID: 'M_PROD',
      CLOVER_API_KEY: 'K_PROD',
      VERCEL_URL: 'rushnrelax.com',
    });
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ href: 'x', id: 'y' }), { status: 200 })
      );
    await createCloverCheckoutSession({
      sessionId: 'ord_pf',
      amount: 1000,
      customerEmail: 'jane@example.com',
      deliveryAddress: {
        name: 'Jane Q Public',
        line1: '123 Main St',
        city: 'Knoxville',
        state: 'TN',
        zip: '37902',
      },
    });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      customer?: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phoneNumber?: string;
      };
    };
    expect(body.customer).toEqual({
      firstName: 'Jane Q',
      lastName: 'Public',
      email: 'jane@example.com',
    });
    // We don't collect a phone number — never send phoneNumber.
    expect(body.customer?.phoneNumber).toBeUndefined();
  });

  it('puts a single-token name in firstName and omits lastName', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: 'true',
      CLOVER_MERCHANT_ID: 'M_PROD',
      CLOVER_API_KEY: 'K_PROD',
    });
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ href: 'x', id: 'y' }), { status: 200 })
      );
    await createCloverCheckoutSession({
      sessionId: 'ord_st',
      amount: 1000,
      deliveryAddress: {
        name: 'Cher',
        line1: '1 Sunset Blvd',
        city: 'LA',
        state: 'CA',
        zip: '90001',
      },
    });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      customer?: { firstName?: string; lastName?: string };
    };
    expect(body.customer).toEqual({ firstName: 'Cher' });
  });

  it('omits the customer object entirely when no email and no name are available', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: 'true',
      CLOVER_MERCHANT_ID: 'M_PROD',
      CLOVER_API_KEY: 'K_PROD',
    });
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ href: 'x', id: 'y' }), { status: 200 })
      );
    await createCloverCheckoutSession({ sessionId: 'ord_no', amount: 1000 });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { customer?: unknown };
    expect(body.customer).toBeUndefined();
  });

  it('does not pre-seed a shipping address into the Clover create payload', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: 'true',
      CLOVER_MERCHANT_ID: 'M_PROD',
      CLOVER_API_KEY: 'K_PROD',
    });
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ href: 'x', id: 'y' }), { status: 200 })
      );
    await createCloverCheckoutSession({
      sessionId: 'ord_sa',
      amount: 1000,
      customerEmail: 'jane@example.com',
      deliveryAddress: {
        name: 'Jane Public',
        line1: '123 Main St',
        city: 'Knoxville',
        state: 'TN',
        zip: '37902',
      },
    });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown> & {
      customer?: Record<string, unknown>;
    };
    expect(body.shippingAddress).toBeUndefined();
    expect(body.customer?.address).toBeUndefined();
    expect(body.customer?.address1).toBeUndefined();
  });

  it('still works against the stub (kill switch OFF) when deliveryAddress is supplied', async () => {
    setEnv({ CLOVER_LIVE_PAYMENTS_ENABLED: undefined });
    const fetchSpy = vi.spyOn(global, 'fetch');
    const res = await createCloverCheckoutSession({
      sessionId: 'ord_stub',
      amount: 1000,
      customerEmail: 'jane@example.com',
      deliveryAddress: {
        name: 'Jane Public',
        line1: '123 Main St',
        city: 'Knoxville',
        state: 'TN',
        zip: '37902',
      },
    });
    expect(res.provider).toBe('stub');
    expect(fetchSpy).not.toHaveBeenCalled();
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
      createCloverCheckoutSession({ sessionId: 'ord_4', amount: 1000 })
    ).rejects.toBeInstanceOf(CloverApiError);
  });

  it('honors CLOVER_BASE_URL override (sandbox)', async () => {
    setEnv({
      CLOVER_LIVE_PAYMENTS_ENABLED: 'true',
      CLOVER_MERCHANT_ID: 'M_SBX',
      CLOVER_API_KEY: 'K_SBX',
      CLOVER_BASE_URL: 'https://apisandbox.dev.clover.com',
    });
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ href: 'x', id: 'y' }), { status: 200 })
      );
    await createCloverCheckoutSession({ sessionId: 'o', amount: 1 });
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith('https://apisandbox.dev.clover.com/')).toBe(true);
  });
});

describe('getCloverPaymentForOrder (#279 reconciliation)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.CLOVER_MERCHANT_ID = 'M_PROD';
    process.env.CLOVER_API_KEY = 'K_PROD';
    delete process.env.CLOVER_BASE_URL;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns null when credentials are missing', async () => {
    delete process.env.CLOVER_MERCHANT_ID;
    delete process.env.CLOVER_API_KEY;
    const res = await getCloverPaymentForOrder('co_1');
    expect(res).toBeNull();
  });

  it('GETs /v3/merchants/{mid}/orders/{cloverOrderId}/payments and surfaces SUCCESS', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          elements: [{ id: 'pay_1', result: 'SUCCESS', amount: 2500 }],
        }),
        { status: 200 }
      )
    );
    const snap = await getCloverPaymentForOrder('co_1');
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.clover.com/v3/merchants/M_PROD/orders/co_1/payments'
    );
    expect(init.method).toBe('GET');
    expect(snap).toEqual(
      expect.objectContaining({
        paymentId: 'pay_1',
        result: 'SUCCESS',
        amount: 2500,
      })
    );
  });

  it('prefers a SUCCESS payment when multiple are returned', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          elements: [
            { id: 'pay_fail', result: 'FAIL' },
            { id: 'pay_ok', result: 'SUCCESS' },
          ],
        }),
        { status: 200 }
      )
    );
    const snap = await getCloverPaymentForOrder('co_2');
    expect(snap?.paymentId).toBe('pay_ok');
    expect(snap?.result).toBe('SUCCESS');
  });

  it('reports PENDING when Clover returns no payment elements', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ elements: [] }), { status: 200 })
    );
    const snap = await getCloverPaymentForOrder('co_3');
    expect(snap?.result).toBe('PENDING');
  });

  it('throws CloverApiError on non-2xx', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('nope', { status: 500 })
    );
    await expect(getCloverPaymentForOrder('co_4')).rejects.toBeInstanceOf(
      CloverApiError
    );
  });
});

describe('refundCloverPayment (#279 / #283)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.CLOVER_MERCHANT_ID = 'M_PROD';
    process.env.CLOVER_API_KEY = 'K_PROD';
    delete process.env.CLOVER_BASE_URL;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('POSTs to /v3/merchants/{mid}/payments/{paymentId}/refunds with the right body shape', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'ref_1', amount: 500 }), {
        status: 200,
      })
    );
    const res = await refundCloverPayment('pay_abc', 500);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.clover.com/v3/merchants/M_PROD/payments/pay_abc/refunds'
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ amount: 500 });
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer K_PROD');
    expect(res).toEqual(
      expect.objectContaining({ refundId: 'ref_1', amount: 500 })
    );
  });

  it('omits amount in the body for a full refund', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'r' }), { status: 200 })
      );
    await refundCloverPayment('pay_full');
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({});
  });

  it('throws when credentials are missing rather than firing a no-auth refund', async () => {
    delete process.env.CLOVER_MERCHANT_ID;
    delete process.env.CLOVER_API_KEY;
    await expect(refundCloverPayment('pay_x')).rejects.toBeInstanceOf(
      CloverApiError
    );
  });

  it('throws CloverApiError on non-2xx', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('boom', { status: 422 })
    );
    await expect(refundCloverPayment('pay_x', 1)).rejects.toBeInstanceOf(
      CloverApiError
    );
  });
});

describe('getCloverOrderIdForCheckout (return-URL order-id discovery — waterfall)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.CLOVER_MERCHANT_ID = 'M_PROD';
    process.env.CLOVER_API_KEY = 'K_PROD';
    delete process.env.CLOVER_BASE_URL;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  const baseInput = {
    cloverCheckoutSessionId: 'sess_abc',
    sessionId: 'cs_abc',
    expectedTotalCents: 2185,
    customerEmail: 'jane@example.com',
    createdAfter: new Date('2026-05-13T10:00:00Z'),
  };

  function mockSequence(
    handlers: Array<(url: string) => Response | Promise<Response>>
  ) {
    const spy = vi.spyOn(global, 'fetch');
    handlers.forEach(h => {
      spy.mockImplementationOnce(async input => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        return h(url);
      });
    });
    return spy;
  }

  it('Given credentials are missing, Then it returns null and makes no fetch', async () => {
    delete process.env.CLOVER_MERCHANT_ID;
    delete process.env.CLOVER_API_KEY;
    const fetchSpy = vi.spyOn(global, 'fetch');
    const res = await getCloverOrderIdForCheckout(baseInput);
    expect(res).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Given /checkouts/{id} returns SUCCESS with orderId, Then that leg wins (no further calls)', async () => {
    const spy = mockSequence([
      () =>
        new Response(JSON.stringify({ orderId: 'CLV_ORD_9' }), { status: 200 }),
    ]);
    const res = await getCloverOrderIdForCheckout(baseInput);
    expect(res).toBe('CLV_ORD_9');
    expect(spy).toHaveBeenCalledOnce();
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/invoicingcheckoutservice/v1/checkouts/sess_abc');
  });

  it('Given /checkouts/{id} 404s and tagged lookup returns 1 hit, Then the tagged leg wins', async () => {
    const spy = mockSequence([
      () => new Response('not found', { status: 404 }),
      () =>
        new Response(
          JSON.stringify({
            elements: [{ id: 'CLV_ORD_TAGGED', createdTime: 1 }],
          }),
          { status: 200 }
        ),
    ]);
    const res = await getCloverOrderIdForCheckout(baseInput);
    expect(res).toBe('CLV_ORD_TAGGED');
    expect(spy).toHaveBeenCalledTimes(2);
    const [taggedUrl] = spy.mock.calls[1] as [string, RequestInit];
    expect(taggedUrl).toContain('/v3/merchants/M_PROD/orders?');
    expect(taggedUrl).toContain('filter=note=cs_abc');
  });

  it('Given /checkouts/{id} 404s and tagged returns 0, When heuristic finds 1 exact total+email match, Then the heuristic leg wins', async () => {
    const spy = mockSequence([
      () => new Response('not found', { status: 404 }),
      () => new Response(JSON.stringify({ elements: [] }), { status: 200 }),
      () =>
        new Response(
          JSON.stringify({
            elements: [
              {
                id: 'CLV_ORD_OTHER',
                total: 999,
                createdTime: 2,
              },
              {
                id: 'CLV_ORD_HEUR',
                total: 2185,
                createdTime: 1,
                customers: {
                  elements: [
                    {
                      emailAddresses: {
                        elements: [{ emailAddress: 'jane@example.com' }],
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        ),
    ]);
    const res = await getCloverOrderIdForCheckout(baseInput);
    expect(res).toBe('CLV_ORD_HEUR');
    expect(spy).toHaveBeenCalledTimes(3);
    const [heurUrl] = spy.mock.calls[2] as [string, RequestInit];
    expect(heurUrl).toContain('filter=createdTime%3E%3D');
    expect(heurUrl).toContain('orderBy=createdTime+DESC');
  });

  it('Given all three legs return empty, Then it returns null (caller leaves session awaiting)', async () => {
    mockSequence([
      () => new Response('not found', { status: 404 }),
      () => new Response(JSON.stringify({ elements: [] }), { status: 200 }),
      () => new Response(JSON.stringify({ elements: [] }), { status: 200 }),
    ]);
    expect(await getCloverOrderIdForCheckout(baseInput)).toBeNull();
  });

  it('Given heuristic returns multiple exact matches, Then it logs a warning and returns the most recent', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockSequence([
      () => new Response('not found', { status: 404 }),
      () => new Response(JSON.stringify({ elements: [] }), { status: 200 }),
      () =>
        new Response(
          JSON.stringify({
            // Already sorted DESC by createdTime per orderBy=createdTime DESC.
            elements: [
              {
                id: 'CLV_ORD_NEW',
                total: 2185,
                createdTime: 200,
                customers: {
                  elements: [
                    {
                      emailAddresses: {
                        elements: [{ emailAddress: 'jane@example.com' }],
                      },
                    },
                  ],
                },
              },
              {
                id: 'CLV_ORD_OLD',
                total: 2185,
                createdTime: 100,
                customers: {
                  elements: [
                    {
                      emailAddresses: {
                        elements: [{ emailAddress: 'jane@example.com' }],
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        ),
    ]);
    const res = await getCloverOrderIdForCheckout(baseInput);
    expect(res).toBe('CLV_ORD_NEW');
    expect(
      warn.mock.calls.some(c => String(c[0] ?? '').includes('matched >1 order'))
    ).toBe(true);
  });

  it('Given a network error on leg 1, Then it catches and falls through to the tagged leg', async () => {
    const spy = vi.spyOn(global, 'fetch');
    spy.mockImplementationOnce(async () => {
      throw new TypeError('network down');
    });
    spy.mockImplementationOnce(
      async () =>
        new Response(
          JSON.stringify({ elements: [{ id: 'CLV_ORD_TAGGED_NET' }] }),
          { status: 200 }
        )
    );
    const res = await getCloverOrderIdForCheckout(baseInput);
    expect(res).toBe('CLV_ORD_TAGGED_NET');
  });

  it('Given a network error on every leg, Then it returns null rather than throwing', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      throw new TypeError('network down');
    });
    expect(await getCloverOrderIdForCheckout(baseInput)).toBeNull();
  });

  it('honors CLOVER_BASE_URL override on all three legs', async () => {
    process.env.CLOVER_BASE_URL = 'https://apisandbox.dev.clover.com';
    const spy = mockSequence([
      () => new Response('not found', { status: 404 }),
      () => new Response(JSON.stringify({ elements: [] }), { status: 200 }),
      () => new Response(JSON.stringify({ elements: [] }), { status: 200 }),
    ]);
    await getCloverOrderIdForCheckout(baseInput);
    for (const call of spy.mock.calls) {
      const [url] = call as [string, RequestInit];
      expect(url.startsWith('https://apisandbox.dev.clover.com/')).toBe(true);
    }
  });
});

describe('splitCustomerName', () => {
  it('splits the last whitespace token as lastName', () => {
    expect(splitCustomerName('Jane Public')).toEqual({
      firstName: 'Jane',
      lastName: 'Public',
    });
  });

  it('keeps middle names with the first name', () => {
    expect(splitCustomerName('Jane Q Public')).toEqual({
      firstName: 'Jane Q',
      lastName: 'Public',
    });
  });

  it('puts a single token in firstName and omits lastName', () => {
    expect(splitCustomerName('Cher')).toEqual({ firstName: 'Cher' });
  });

  it('trims and collapses internal whitespace', () => {
    expect(splitCustomerName('  Jane   Public  ')).toEqual({
      firstName: 'Jane',
      lastName: 'Public',
    });
  });

  it('returns {} for undefined / empty / whitespace-only input', () => {
    expect(splitCustomerName(undefined)).toEqual({});
    expect(splitCustomerName('')).toEqual({});
    expect(splitCustomerName('   ')).toEqual({});
  });
});
