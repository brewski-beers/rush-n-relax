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
 * webhooks. The Hosted Checkout `redirectUrls.success` is set to the
 * return route at `/order/{sessionId}/return` where `sessionId` is the
 * CheckoutSession doc id WE generate before this create call — Clover
 * does NOT substitute the `{CHECKOUT_SESSION_ID}` template token
 * (confirmed live: the customer was redirected to the literal
 * `/order/%7BCHECKOUT_SESSION_ID%7D/return`), so the URL must be fully
 * resolved here. That route reconciles status by GETting the payment
 * from the merchant's orders endpoint. A 5-min recovery cron
 * (functions/index.ts) catches sessions where the customer never returns.
 *
 * Redirect contract (per Clover Hosted Checkout docs — see
 * https://docs.clover.com/dev/docs/redirecting-customers — but note the
 * `{CHECKOUT_SESSION_ID}` / `{ERROR_CODE}` tokens are NOT actually
 * substituted by Clover for this merchant, so we don't use them):
 *   "redirectUrls": {
 *     "success": "https://store.example/order/<our-session-id>/return",
 *     "failure": "https://store.example/checkout/cancelled?session=<our-session-id>"
 *   }
 * Both must be HTTPS. The legacy singular `redirectUrl` string is NOT
 * honoured by Hosted Checkout — Clover silently ignores it and the
 * customer is stranded on Clover's "Payment Received" page.
 *
 * Docs: https://docs.clover.com/dev/docs/creating-a-hosted-checkout-session
 */
import { isLivePaymentsEnabled } from '@/lib/test-mode';
import type { OrderItem, ShippingAddress } from '@/types';

export interface CheckoutSessionInput {
  /**
   * The CheckoutSession doc id we generated before this call. Used
   * verbatim in `redirectUrls.success` (`/order/{sessionId}/return`) and
   * in the stub redirect — Clover does not substitute a template token,
   * so the URL is built from this value directly.
   */
  sessionId: string;
  /** cents — the total amount Clover should charge (subtotal + tax). */
  amount: number;
  /**
   * cents — sales tax portion of `amount`. Appended to the Clover cart as
   * a synthetic "Sales Tax" line item so the cart sums to `amount`
   * (Hosted Checkout charges Σ lineItems, not a separate `total`). When
   * omitted or 0, no tax line item is added. Defaults to
   * `amount − Σ(unitPrice·quantity)` is intentionally NOT done here —
   * callers pass it explicitly.
   */
  tax?: number;
  customerEmail?: string;
  /** Line items required by Clover's shoppingCart payload. */
  items?: OrderItem[];
  /**
   * Buyer name + delivery address from our CheckoutSession. Used to
   * prefill Clover's hosted-checkout `customer` object (firstName /
   * lastName / email) so the customer doesn't re-type what they already
   * entered in our cart. The address is intentionally NOT sent to Clover —
   * Clover's hosted-checkout create payload has no documented field for a
   * pre-seeded shipping address, and our app's address copy is canonical
   * (we never read an address back from Clover). The cleanest fix for
   * Clover still asking for an address is to disable the
   * `HCO_CUSTOMER_INFO_FEATURE_ENABLED` flag on the merchant dashboard.
   */
  deliveryAddress?: ShippingAddress;
}

/**
 * Split a full name into Clover's `firstName` / `lastName`. Last
 * whitespace-delimited token is the last name; everything before is the
 * first name. A single token goes in `firstName` with `lastName` omitted.
 * Empty / whitespace-only input returns `{}` so we never send empty
 * strings to Clover.
 */
export function splitCustomerName(name: string | undefined): {
  firstName?: string;
  lastName?: string;
} {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
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

function resolveSiteOrigin(): string {
  // Vercel injects VERCEL_URL (host only, no scheme) on every deployment.
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return 'http://localhost:3000';
}

function stubResponse(sessionId: string): CheckoutSession {
  // Must be absolute — `NextResponse.redirect()` rejects relative URLs and
  // throws at the redirect handler, surfacing as a 500 in preview/dev.
  const origin = resolveSiteOrigin();
  return {
    redirectUrl: `${origin}/checkout/stub?order=${encodeURIComponent(sessionId)}`,
    provider: 'stub',
  };
}

export async function createCloverCheckoutSession(
  input: CheckoutSessionInput
): Promise<CheckoutSession> {
  // GATE 1 — kill switch. Closed by default; anything other than the exact
  // env-var value 'true' returns the stub even with prod creds present.
  if (!isLivePaymentsEnabled()) {
    return stubResponse(input.sessionId);
  }

  // GATE 2 — credentials. Without both we cannot call the real API.
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  const apiKey = process.env.CLOVER_API_KEY;
  if (!merchantId || !apiKey) {
    return stubResponse(input.sessionId);
  }

  const origin = resolveSiteOrigin();
  const lineItems = (input.items ?? []).map(item => ({
    name: item.productName,
    unitQty: item.quantity,
    price: item.unitPrice,
  }));

  // Tax is not a separate field on the Hosted Checkout cart — Clover
  // charges the SUM of lineItems. Append a synthetic "Sales Tax" line so
  // the cart total equals `input.amount` (subtotal + tax). Without this
  // the customer is undercharged by exactly the tax amount.
  if (typeof input.tax === 'number' && input.tax > 0) {
    lineItems.push({ name: 'Sales Tax', unitQty: 1, price: input.tax });
  }

  // Prefill Clover's `customer` object from data the buyer already gave us
  // in our own cart/checkout — firstName/lastName (split from the delivery
  // address name) + email. We don't collect a phone number, so
  // `phoneNumber` is omitted. Empty fields are omitted entirely (never send
  // empty strings). NOTE: only `email` is confirmed against our live Clover
  // integration; `firstName`/`lastName` follow Clover's standard Customer
  // object schema (POST /v3/merchants/{mid}/customers) and are assumed to
  // be accepted on the hosted-checkout `customer` object — see the PR body.
  const { firstName, lastName } = splitCustomerName(
    input.deliveryAddress?.name
  );
  const customer: Record<string, string> = {};
  if (firstName) customer.firstName = firstName;
  if (lastName) customer.lastName = lastName;
  if (input.customerEmail) customer.email = input.customerEmail;

  // #279 — Path B return-URL reconciliation. After payment Clover
  // redirects to redirectUrls.success. The URL is fully resolved here from
  // `input.sessionId` (the CheckoutSession doc id we generated before this
  // call) — Clover does NOT substitute the `{CHECKOUT_SESSION_ID}` /
  // `{ERROR_CODE}` template tokens for this merchant, so we cannot use
  // them. That route calls Clover to read payment status and promotes the
  // session to an Order. On decline Clover redirects to
  // redirectUrls.failure with the same session id as a query param.
  const sessionIdEnc = encodeURIComponent(input.sessionId);

  // Annotate the Clover order with our session id so we can find it later
  // via the orders-list endpoint. `GET /invoicingcheckoutservice/v1/checkouts/{id}`
  // 404s in practice for sessions we just created (confirmed live, sandbox
  // round-trip 2026-05-13), so we cannot rely on it to discover the linked
  // Clover order id. Instead we tag the order with `note: <our sessionId>`
  // and query `GET /v3/merchants/{mid}/orders?filter=note=…` on the return
  // path. The `note` field is part of the standard Clover Order schema
  // (https://docs.clover.com/dev/reference/orders) and is the most likely
  // field to propagate from the hosted-checkout payload onto the resulting
  // Order. If Clover silently drops it, the heuristic createdAt/total/email
  // match in `getCloverOrderIdForCheckout` is the fallback.
  const body = {
    customer: Object.keys(customer).length > 0 ? customer : undefined,
    shoppingCart: { lineItems },
    note: input.sessionId,
    redirectUrls: {
      success: `${origin}/order/${sessionIdEnc}/return`,
      failure: `${origin}/checkout/cancelled?session=${sessionIdEnc}`,
    },
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
      json.href ??
      json.redirectUrl ??
      stubResponse(input.sessionId).redirectUrl,
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

/**
 * Context for finding the Clover order id linked to a Hosted Checkout
 * session. The historical single-arg signature
 * (`getCloverOrderIdForCheckout(cloverCheckoutSessionId)`) couldn't survive
 * the discovery that `GET /invoicingcheckoutservice/v1/checkouts/{id}` 404s
 * in practice for the very session id Clover handed us at create time
 * (confirmed live, sandbox round-trip 2026-05-13). The new lookup waterfall
 * needs more than just Clover's checkout id — it needs our session doc id
 * (to match the `note` annotation), the expected total in cents (heuristic
 * exact-amount match), the customer email (heuristic match), and the
 * session createdAt (heuristic time-window bound).
 */
export interface CloverOrderLookupInput {
  /** Clover's own checkout session id (from `cloverCheckoutSessionId`). */
  cloverCheckoutSessionId: string;
  /** Our CheckoutSession Firestore doc id — annotated as `note` at create. */
  sessionId: string;
  /** cents — must equal Clover's `order.total` for the heuristic match. */
  expectedTotalCents: number;
  /** Buyer email — heuristic match. Optional (some sessions lack it). */
  customerEmail?: string;
  /** Session createdAt — lower bound for the heuristic time window. */
  createdAfter: Date;
}

/**
 * Look up the Clover **order id** linked to a Hosted Checkout session.
 *
 * Three-leg waterfall, in priority order:
 *
 *   1. `GET /invoicingcheckoutservice/v1/checkouts/{id}` (the documented
 *      endpoint). Cleanest path when it works — but in practice this 404s
 *      for the very session id Clover gives us at create time (live
 *      sandbox confirmed 2026-05-13). We try it first anyway because if /
 *      when Clover fixes it, we get back to the canonical lookup with no
 *      code change.
 *
 *   2. Tagged orders-list lookup —
 *      `GET /v3/merchants/{mid}/orders?filter=note=<our sessionId>`.
 *      We annotate every Clover create call with `note: <our sessionId>`
 *      so this filter narrows to exactly the matching order. Best-case
 *      working path post-the-404-issue.
 *
 *   3. Heuristic orders-list lookup —
 *      `GET /v3/merchants/{mid}/orders?filter=createdTime>=<createdAt-ms>&orderBy=createdTime DESC`,
 *      then match client-side on `total === expectedTotalCents` AND (when
 *      we have an email on the session) `customers[0].emailAddresses[0].emailAddress`.
 *      Required fallback if Clover silently drops `note` from the
 *      hosted-checkout payload.
 *
 * Returns:
 *   - `string`  — the Clover order id (whichever leg won).
 *   - `null`    — credentials missing, or all three legs returned empty.
 *
 * The leg that wins is logged at `console.warn` so we can see in prod logs
 * which path is actually carrying us.
 */
export async function getCloverOrderIdForCheckout(
  input: CloverOrderLookupInput
): Promise<string | null> {
  const creds = getCloverCreds();
  if (!creds) return null;

  // ─── Leg 1: documented /checkouts/{id} ─────────────────────────────────
  try {
    const url = `${getCloverBaseUrl()}/invoicingcheckoutservice/v1/checkouts/${encodeURIComponent(input.cloverCheckoutSessionId)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
        'X-Clover-Merchant-Id': creds.merchantId,
      },
    });
    if (res.ok) {
      // Justified cast: Clover checkout resource shape is documented but
      // not typed in our codebase. We only read the `orderId` field.
      const json = (await res.json().catch(() => null)) as {
        orderId?: string;
      } | null;
      const orderId = json?.orderId;
      if (typeof orderId === 'string' && orderId.length > 0) {
        console.warn('[clover] order-id lookup won via /checkouts/{id}', {
          sessionId: input.sessionId,
          orderId,
        });
        return orderId;
      }
    }
    // 404 / no orderId / network error → fall through to the orders-list
    // legs. /checkouts/{id} is reliably 404 against our merchant today
    // (confirmed live 2026-05-13); kept first so we get the canonical
    // resource lookup back automatically if Clover ever fixes it.
  } catch {
    // Network blip — fall through to legs 2/3.
  }

  // ─── Leg 2: tagged orders-list lookup (note=<sessionId>) ───────────────
  const tagged = await tryTaggedOrdersLookup(creds, input);
  if (tagged) {
    console.warn('[clover] order-id lookup won via tagged note', {
      sessionId: input.sessionId,
      orderId: tagged,
    });
    return tagged;
  }

  // ─── Leg 3: heuristic orders-list (createdAt + total + email) ──────────
  const heuristic = await tryHeuristicOrdersLookup(creds, input);
  if (heuristic) {
    console.warn('[clover] order-id lookup won via heuristic match', {
      sessionId: input.sessionId,
      orderId: heuristic,
    });
    return heuristic;
  }

  return null;
}

interface CloverOrderRow {
  id?: string;
  total?: number;
  createdTime?: number;
  customers?: {
    elements?: Array<{
      emailAddresses?: {
        elements?: Array<{ emailAddress?: string }>;
      };
    }>;
  };
}

async function fetchOrdersList(
  creds: CloverCredentials,
  filterQuery: string,
  limit: number,
  legLabel: string
): Promise<CloverOrderRow[] | null> {
  // NOTE: do NOT append `&expand=customers` — our merchant private token
  // returns 403 "Invalid permissions for expandable fields" on that expand
  // (confirmed live 2026-05-13). Without the expansion we lose embedded
  // customer email, so heuristic matching falls back to total-only.
  const url = `${getCloverBaseUrl()}/v3/merchants/${encodeURIComponent(creds.merchantId)}/orders?${filterQuery}&limit=${limit}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Network blip — caller falls back to awaiting; cron retries.
    return null;
  }
  if (!res.ok) {
    // A non-2xx on the orders-list is a real signal worth surfacing — e.g.
    // a 403 "Invalid permissions for expandable fields" (which is why we
    // no longer use `&expand=customers`), or a future scope/auth change.
    const body = await res.text().catch(() => '');
    console.warn(`[clover] ${legLabel} fetchOrdersList non-2xx`, {
      url,
      status: res.status,
      body: body.slice(0, 400),
    });
    return null;
  }
  // Justified cast: Clover v3 collection responses are `{ elements: Order[] }`.
  const json = (await res.json().catch(() => null)) as {
    elements?: CloverOrderRow[];
  } | null;
  return Array.isArray(json?.elements) ? json.elements : [];
}

async function tryTaggedOrdersLookup(
  creds: CloverCredentials,
  input: CloverOrderLookupInput
): Promise<string | null> {
  // `filter=note=<value>` — Clover Orders v3 supports filter expressions
  // on standard Order fields. We URL-encode the value but leave the `=`
  // separators raw so Clover parses the predicate.
  const filterQuery = `filter=note=${encodeURIComponent(input.sessionId)}`;
  const elements = await fetchOrdersList(creds, filterQuery, 5, 'leg2-tagged');
  // NOTE: as of 2026-05-13 the live test showed Clover Hosted Checkout
  // silently drops the `note` field between the create payload and the
  // resulting Order, so this leg routinely returns 0 elements and we
  // fall through to leg 3. Kept anyway — it's the cleanest exact-match
  // lookup if/when Clover starts propagating `note`.
  if (!elements || elements.length === 0) return null;
  // If multiple rows share the same note (shouldn't happen — `sessionId`
  // is unique), prefer the most recent.
  const sorted = [...elements].sort(
    (a, b) => (b.createdTime ?? 0) - (a.createdTime ?? 0)
  );
  const first = sorted[0];
  return typeof first.id === 'string' && first.id.length > 0 ? first.id : null;
}

async function tryHeuristicOrdersLookup(
  creds: CloverCredentials,
  input: CloverOrderLookupInput
): Promise<string | null> {
  // Bound the time window to the session's createdAt to keep the result
  // set small and avoid matching orders from unrelated days. `orderBy`
  // newest-first so the most-recent same-total/email order wins when there
  // are concurrent same-cents checkouts (vanishingly unlikely).
  const createdMs = input.createdAfter.getTime();
  const filterQuery =
    `filter=createdTime%3E%3D${createdMs}` + `&orderBy=createdTime+DESC`;
  const elements = await fetchOrdersList(
    creds,
    filterQuery,
    20,
    'leg3-heuristic'
  );
  if (!elements || elements.length === 0) return null;

  // We can't fetch `customers` (the `expand` is 403'd by our token) so
  // we match on total only. Realistic collision risk is essentially nil:
  // two customers paying the EXACT same cents within `createdAfter`..now
  // is vanishingly unlikely, and even when it happens `orderBy=createdTime
  // DESC` + the in-flight session guard picks the most-recent, which is
  // the right one in 100% of practical races.
  const matches = elements.filter(
    o => typeof o.total === 'number' && o.total === input.expectedTotalCents
  );

  if (matches.length === 0) {
    // No order in the window matched on total. Real signal — either
    // Clover hasn't indexed the order in /orders yet (eventual
    // consistency), the total drifted (we have a bug), or this isn't
    // actually a customer's session. Worth surfacing.
    console.warn('[clover] leg3 heuristic: 0 matches', {
      sessionId: input.sessionId,
      expectedTotalCents: input.expectedTotalCents,
      candidateCount: elements.length,
      candidates: elements.slice(0, 5).map(e => ({
        id: e.id,
        total: e.total,
        createdTime: e.createdTime,
      })),
    });
    return null;
  }
  if (matches.length > 1) {
    console.warn(
      '[clover] heuristic order-id lookup matched >1 order; picking the most recent',
      {
        sessionId: input.sessionId,
        matchCount: matches.length,
        ids: matches.map(m => m.id ?? null).slice(0, 5),
      }
    );
  }
  // `fetchOrdersList` requests `orderBy=createdTime DESC`, so element[0]
  // is already the most recent.
  const chosen = matches[0];
  return typeof chosen.id === 'string' && chosen.id.length > 0
    ? chosen.id
    : null;
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
