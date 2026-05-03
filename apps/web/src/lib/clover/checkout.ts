/**
 * Clover eComm Hosted Checkout bridge.
 *
 * Behavior is governed by TWO gates, in this order:
 *
 *   1. `isLivePaymentsEnabled()` — the global kill switch. When false (the
 *      default), this function ALWAYS returns the local stub, regardless of
 *      whether production credentials are present. This is the safety guard
 *      that prevents accidental real charges before launch.
 *
 *   2. Credential presence — even with the kill switch ON, we fall back to
 *      the stub if `CLOVER_MERCHANT_ID` or `CLOVER_API_KEY` are missing.
 *
 * Only when BOTH gates pass do we invoke the real Clover hosted-checkout API.
 *
 * Path B notes (#279): payment confirmation cannot rely on app-level
 * webhooks. The Hosted Checkout `redirectUrl` is set to the new return
 * route at `/order/{orderId}/return`, which reconciles status by GETting
 * the payment from the merchant's orders endpoint. A 5-min recovery cron
 * (functions/index.ts) catches sessions where the customer never returns.
 *
 * Docs: https://docs.clover.com/docs/using-checkout-api
 */
import { isLivePaymentsEnabled } from '@/lib/test-mode';
import type { OrderItem } from '@/types';

export interface CheckoutSessionInput {
  orderId: string;
  /** cents */
  amount: number;
  customerEmail?: string;
  /** Line items required by Clover's shoppingCart payload. */
  items?: OrderItem[];
}

export interface CheckoutSession {
  redirectUrl: string;
  provider: 'clover' | 'stub';
  /** Clover's checkout session id (only present when provider === 'clover'). */
  cloverCheckoutSessionId?: string;
}

export class CloverApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Clover API error ${status}: ${body.slice(0, 200)}`);
    this.name = 'CloverApiError';
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_CLOVER_API_BASE = 'https://api.clover.com';

function getCloverBaseUrl(): string {
  return process.env.CLOVER_BASE_URL || DEFAULT_CLOVER_API_BASE;
}

function stubResponse(orderId: string): CheckoutSession {
  return {
    redirectUrl: `/checkout/stub?order=${encodeURIComponent(orderId)}`,
    provider: 'stub',
  };
}

function resolveSiteOrigin(): string {
  // Vercel injects VERCEL_URL (host only, no scheme) on every deployment.
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return 'http://localhost:3000';
}

export async function createCloverCheckoutSession(
  input: CheckoutSessionInput
): Promise<CheckoutSession> {
  // GATE 1 — kill switch. Closed by default; anything other than the exact
  // env-var value 'true' returns the stub even with prod creds present.
  if (!isLivePaymentsEnabled()) {
    return stubResponse(input.orderId);
  }

  // GATE 2 — credentials. Without both we cannot call the real API.
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  const apiKey = process.env.CLOVER_API_KEY;
  if (!merchantId || !apiKey) {
    return stubResponse(input.orderId);
  }

  const origin = resolveSiteOrigin();
  const lineItems = (input.items ?? []).map(item => ({
    name: item.productName,
    unitQty: item.quantity,
    price: item.unitPrice,
  }));

  // #279 — Path B return-URL reconciliation. After payment the customer is
  // redirected to /order/{id}/return which calls Clover to read payment
  // status and transitions the order. Append `?session=` so the return
  // route can resolve the Clover checkout/order id without a Firestore
  // read first.
  const body = {
    customer: input.customerEmail ? { email: input.customerEmail } : undefined,
    shoppingCart: { lineItems },
    redirectUrl: `${origin}/order/${input.orderId}/return`,
  };

  const res = await fetch(
    `${getCloverBaseUrl()}/invoicingcheckoutservice/v1/checkouts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Clover-Merchant-Id': merchantId,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new CloverApiError(res.status, text);
  }

  // Justified cast: Clover response shape is documented but not typed in our
  // codebase. We only read two well-known fields and tolerate either casing.
  const json = (await res.json()) as {
    href?: string;
    redirectUrl?: string;
    checkoutSessionId?: string;
    id?: string;
  };

  return {
    redirectUrl:
      json.href ?? json.redirectUrl ?? stubResponse(input.orderId).redirectUrl,
    provider: 'clover',
    cloverCheckoutSessionId: json.checkoutSessionId ?? json.id,
  };
}

// ─── Path B reconciliation helpers (#279) ─────────────────────────────────

export type CloverPaymentResult = 'SUCCESS' | 'FAIL' | 'PENDING' | 'UNKNOWN';

export interface CloverPaymentSnapshot {
  /** Clover payment id (the `id` on the payment record). */
  paymentId?: string;
  /** Normalized result. `UNKNOWN` means we could not parse the response. */
  result: CloverPaymentResult;
  /** cents — present when Clover returned an amount. */
  amount?: number;
  /** Raw payload for logging / debugging. */
  raw?: unknown;
}

interface CloverCredentials {
  merchantId: string;
  apiKey: string;
}

function getCloverCreds(): CloverCredentials | null {
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  const apiKey = process.env.CLOVER_API_KEY;
  if (!merchantId || !apiKey) return null;
  return { merchantId, apiKey };
}

function normalizeResult(raw: unknown): CloverPaymentResult {
  if (raw === 'SUCCESS' || raw === 'success') return 'SUCCESS';
  if (raw === 'FAIL' || raw === 'FAILED' || raw === 'fail') return 'FAIL';
  if (raw === 'PENDING' || raw === 'pending') return 'PENDING';
  return 'UNKNOWN';
}

/**
 * GET the Clover payment(s) for a given Clover order id, then collapse the
 * collection into a single canonical snapshot. We use the most recent
 * SUCCESS payment if one exists, otherwise the first non-empty record.
 *
 * Endpoint shape per spec:
 *   GET {CLOVER_BASE_URL}/v3/merchants/{MERCHANT_ID}/orders/{cloverOrderId}/payments
 *
 * Returns `null` when credentials are missing (caller treats as "cannot
 * reconcile, leave order alone").
 */
export async function getCloverPaymentForOrder(
  cloverOrderId: string
): Promise<CloverPaymentSnapshot | null> {
  const creds = getCloverCreds();
  if (!creds) return null;

  const url = `${getCloverBaseUrl()}/v3/merchants/${creds.merchantId}/orders/${encodeURIComponent(cloverOrderId)}/payments`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new CloverApiError(res.status, text);
  }

  // Justified cast: Clover collection responses are typed as
  // `{ elements: Payment[] }` per docs.
  const json = (await res.json()) as {
    elements?: Array<{
      id?: string;
      result?: string;
      amount?: number;
    }>;
  };

  const elements = Array.isArray(json.elements) ? json.elements : [];
  if (elements.length === 0) {
    return { result: 'PENDING', raw: json };
  }

  const success = elements.find(p => normalizeResult(p.result) === 'SUCCESS');
  const chosen = success ?? elements[0];
  return {
    paymentId: chosen.id,
    result: normalizeResult(chosen.result),
    amount: typeof chosen.amount === 'number' ? chosen.amount : undefined,
    raw: json,
  };
}

export interface CloverRefundResult {
  refundId?: string;
  /** cents */
  amount?: number;
  raw?: unknown;
}

/**
 * POST a refund against a Clover payment.
 * Endpoint per spec:
 *   POST {CLOVER_BASE_URL}/v3/merchants/{MERCHANT_ID}/payments/{paymentId}/refunds
 *
 * `amount` is optional — omitted means full refund.
 */
export async function refundCloverPayment(
  paymentId: string,
  amount?: number
): Promise<CloverRefundResult> {
  const creds = getCloverCreds();
  if (!creds) {
    throw new CloverApiError(
      0,
      'Clover credentials missing — refusing to issue refund'
    );
  }

  const url = `${getCloverBaseUrl()}/v3/merchants/${creds.merchantId}/payments/${encodeURIComponent(paymentId)}/refunds`;
  const body = amount !== undefined ? JSON.stringify({ amount }) : '{}';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new CloverApiError(res.status, text);
  }

  const json = (await res.json()) as { id?: string; amount?: number };
  return {
    refundId: json.id,
    amount: typeof json.amount === 'number' ? json.amount : undefined,
    raw: json,
  };
}
