/**
 * Clover eComm Hosted Checkout bridge.
 *
 * When CLOVER_MERCHANT_ID + CLOVER_API_KEY + CLOVER_BASE_URL are present, this
 * module POSTs to Clover's Invoicing Checkout Service and returns the redirect
 * URL + provider session id. When any of those env vars are missing (CI,
 * emulator, local dev without sandbox creds) it returns a stub URL so the rest
 * of the storefront flow can be exercised.
 *
 * Path B (merchant private token) auth:
 *   Authorization: Bearer <CLOVER_API_KEY>
 *
 * Endpoint:
 *   POST {CLOVER_BASE_URL}/invoicingcheckoutservice/v1/checkouts
 *
 * Docs: https://docs.clover.com/docs/using-checkout-api
 * Research: vault projects/rush-n-relax/clover-hosted-checkout.md
 */

export interface CheckoutLineItemInput {
  /** Display name shown on the Clover hosted checkout page. */
  name: string;
  /** Quantity (integer ≥ 1). */
  quantity: number;
  /** Unit price in cents. */
  unitPrice: number;
}

export interface CheckoutSessionInput {
  orderId: string;
  /** Total amount in cents — used as a sanity check; Clover recomputes from line items. */
  amount: number;
  customerEmail?: string;
  /** Line items to render on the hosted checkout page. */
  lineItems: CheckoutLineItemInput[];
}

export interface CheckoutSession {
  /** URL to redirect the customer to (Clover-hosted page or local stub). */
  redirectUrl: string;
  /** Clover-side checkout session id (used to reconcile via GET on return). */
  sessionId: string;
  provider: 'clover' | 'stub';
}

/** Error thrown when the Clover API returns a non-2xx response. */
export class CloverApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Clover API error ${status}: ${body.slice(0, 500)}`);
    this.name = 'CloverApiError';
    this.status = status;
    this.body = body;
  }
}

interface CloverCheckoutResponse {
  href?: string;
  checkoutSessionId?: string;
}

function resolveOrigin(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return 'http://localhost:3000';
}

export async function createCloverCheckoutSession(
  input: CheckoutSessionInput
): Promise<CheckoutSession> {
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  const apiKey = process.env.CLOVER_API_KEY;
  const baseUrl = process.env.CLOVER_BASE_URL;

  const redirectReturn = `${resolveOrigin()}/order/${encodeURIComponent(input.orderId)}/return`;

  // Stub fallback for emulator/CI (no creds wired).
  if (!merchantId || !apiKey || !baseUrl) {
    const stubSessionId = `stub-${input.orderId}`;
    return {
      redirectUrl: `/checkout/stub?order=${encodeURIComponent(input.orderId)}`,
      sessionId: stubSessionId,
      provider: 'stub',
    };
  }

  const body = {
    customer: input.customerEmail ? { email: input.customerEmail } : undefined,
    shoppingCart: {
      lineItems: input.lineItems.map(li => ({
        name: li.name,
        unitQty: li.quantity,
        price: li.unitPrice,
      })),
    },
    redirectUrl: redirectReturn,
  };

  const url = `${baseUrl.replace(/\/$/, '')}/invoicingcheckoutservice/v1/checkouts`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Clover-Merchant-Id': merchantId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new CloverApiError(res.status, text);
  }

  const data = (await res.json()) as CloverCheckoutResponse;
  if (!data.href || !data.checkoutSessionId) {
    throw new CloverApiError(
      res.status,
      `Malformed Clover response: ${JSON.stringify(data)}`
    );
  }

  return {
    redirectUrl: data.href,
    sessionId: data.checkoutSessionId,
    provider: 'clover',
  };
}
