# Clover Hosted Checkout — Capability Research

> Research spike for issue #270. Validates assumptions in upstream tickets #9, #10, #14
> (payment success, failure, refund flows). Last verified against Clover developer docs
> on 2026-04-27. Anything marked **Unverified** must be confirmed against a sandbox
> account before committing implementation work.

---

## 0. Path A vs Path B — credentials matter

Clover supports two authentication paths, and they have **completely different webhook stories**. Be sure which one applies before touching webhook code.

| Path | Acquisition | Webhook support | Our prod state | Our sandbox state |
|---|---|---|---|---|
| **A — Developer App (OAuth)** | TBB builds an App in the Clover Developer Dashboard → merchant installs it → app gets per-merchant token via OAuth. | **Yes** — app-level webhook URL + HMAC secret (`X-Clover-Auth`), one secret per app, fires for every merchant where the app is installed. | Not yet (see issue #302) | Sandbox App `NTVE7RZRR13N4` exists, not used for webhooks |
| **B — Merchant-issued private token** | Merchant logs into their Clover dashboard → Setup → API Tokens → generates a per-merchant token → hands it to TBB. | **No app-level webhooks.** Merchant-managed webhooks may exist on some plan tiers but are unreliable. | ✅ Live (private token + 13-char merchant ID) | ✅ Live (sandbox merchant `FFG76YKEA9QK1` + Web API token) |

**We are on Path B for both prod and sandbox today.** Implications:
- Payment confirmation cannot rely on webhooks — see issue #279 (return-URL reconciliation + 5-min recovery cron)
- Refunds still work (`POST /v1/refunds`) — Path B is fully launch-viable
- Path A is tracked as an ops-quality upgrade (issue #302) — once the client installs a TBB-built App, we can switch the existing `/api/webhooks/clover` stub to a real handler

The rest of this doc describes Clover's webhook capabilities for completeness and to inform the Path A upgrade. **None of it applies to our current Path B integration.**

### Dynamic preview URL caveat
Vercel preview deploys get per-deploy hostnames (e.g. `rush-n-relax-jgj5i8w80-…vercel.app`). The Clover Hosted Checkout `redirectUrl` is per-session (passed in the request body), so dynamic preview URLs work fine for the redirect itself. However, if Clover ever requires redirect-URL allowlisting on their end (some payment providers do), preview deploys would break. Watch for this during sandbox testing.

### Environment variables (current state)

| Var | Production | Preview | Notes |
|---|---|---|---|
| `CLOVER_MERCHANT_ID` | ✅ client's prod merchant | ✅ `FFG76YKEA9QK1` (TBB sandbox) | 13-char alphanumeric |
| `CLOVER_API_KEY` | ✅ client's prod private token | ✅ TBB sandbox Web API Token | Used as `Authorization: Bearer <token>` |
| `CLOVER_BASE_URL` | ✅ `https://api.clover.com` | ✅ `https://apisandbox.dev.clover.com` | |
| `CLOVER_WEBHOOK_SECRET` | ❌ N/A on Path B | ❌ N/A on Path B | Only set when we move to Path A (#302) |

---

## TL;DR

| Capability | Answer | Confidence |
|---|---|---|
| Webhooks fired by Hosted Checkout | **Yes — via the standard Clover webhooks pipeline (V3 Merchant events).** Hosted Checkout creates real `payment` and `order` records under the merchant; those records trigger the same webhooks as in-person sales. | High |
| Discrete `payment.succeeded` / `payment.failed` events | **No — Clover does not emit semantic payment-lifecycle events.** Webhooks are CRUD-shaped (`type: CREATE | UPDATE | DELETE`) on object types (`P` = payment, `O` = order, `OA` = order action). Consumers must GET the payment by id and inspect `result` (`SUCCESS` / `FAIL`). | High |
| `payment.refunded` event | **Refund is a separate object** (`R` event type for refunds, `CR` for credit refunds in some app configs). Refund creation arrives as its own webhook, not as an UPDATE on the original payment. | High |
| Signature header | **`X-Clover-Auth`** — HMAC-SHA256 of the raw JSON body using the **app's signing secret** (set when the webhook URL is verified). One secret per app, **not** per merchant. | High |
| Refund via API for hosted-checkout payments | **Yes.** `POST /v1/refunds` (Ecommerce API) for full/partial refunds against an Ecommerce charge; or `POST /v3/merchants/{mId}/refunds` against the resulting Clover `payment.id` once it exists in the merchant ledger. | High |
| Sandbox available | **Yes** — sandbox.dev.clover.com with separate developer account, separate test merchant, separate API tokens. | High |

**Bottom line for #9/#10/#14:** the assumed event names (`payment.succeeded` etc.) **do not exist** as-is. The architecture still works, but the webhook handler must be written against Clover's CRUD-on-object model — fan in to a single `/api/webhooks/clover` route, branch on `(type, objectType)`, then GET the object to determine `result`.

---

## 1. Webhook events

### Source
- https://docs.clover.com/docs/webhooks
- https://docs.clover.com/docs/configure-webhooks
- https://docs.clover.com/docs/webhook-events-and-payload

### Payload shape (top level)

```json
{
  "appId": "ABCDEF1234567",
  "merchants": {
    "MERCHANT_ID_1": [
      {
        "objectId": "P:ABC123XYZ",
        "type": "CREATE",
        "ts": 1714000000000
      }
    ]
  }
}
```

`objectId` is `<objectType>:<id>`. Object types relevant to Hosted Checkout:

| Code | Object | Notes |
|---|---|---|
| `P`  | Payment | Charge succeeded → CREATE. Voids/refunds appear as separate refund objects. |
| `O`  | Order   | Hosted Checkout creates an order alongside the payment. |
| `OA` | Order action | Order state transitions. |
| `A`  | App (install/uninstall) | Provisioning. |
| `M`  | Merchant | Property changes. |
| `C`  | Customer | If created via Checkout. |

**There is no `payment.succeeded` event.** The CREATE of a `P` object means a payment row was written; the row may still have `result: "FAIL"`. Always GET `/v3/merchants/{mId}/payments/{paymentId}` and inspect:

```json
{
  "id": "ABC123XYZ",
  "result": "SUCCESS",   // or "FAIL"
  "amount": 12345,
  "order": { "id": "..." },
  "tender": { "labelKey": "com.clover.tender.credit_card" }
}
```

### Failure handling
Failed Hosted Checkout attempts **may not create a `P` record at all** — the customer is bounced back to the checkout page. Your code cannot rely on a `FAIL` webhook for "card declined." Use the Hosted Checkout return URL + `GET /invoicingcheckoutservice/v1/checkouts/{checkoutSessionId}` to detect terminal failure, OR poll until you see either a `P` CREATE or a session expiry.

### Refund event
A refund creates a new object (typically `R:<refundId>`). Subscribe to **Refunds** when configuring webhooks. Payload includes the parent `payment.id` so you can correlate to the original order.

---

## 2. Signature verification

### Source
- https://docs.clover.com/docs/webhooks#verify-events

### Header
**`X-Clover-Auth`**

The header carries an HMAC-SHA256 hex digest of the **raw request body** signed with the **app's webhook signing secret**. The secret is shown once when you set the webhook URL in the Clover Developer Dashboard and confirm the verification challenge.

- **Scope: per-app, not per-merchant.** All merchants who install your app emit webhooks signed with the same secret.
- Verification: `expected = hmac_sha256_hex(body, APP_WEBHOOK_SECRET)` then `crypto.timingSafeEqual(expected, header)`.
- Initial setup: Clover sends a one-time GET with a `?verificationCode=...` query param to your endpoint; you must echo it back to the developer dashboard to activate the webhook.

### Implementation note for RnR
- Read raw body in the route handler before JSON.parse — Next.js App Router needs `await req.text()` first, then verify, then parse.
- Store the secret in `CLOVER_WEBHOOK_SECRET` (Vercel env var, all environments). Use the same value across Preview and Production since the dev sandbox app and prod app each have their own secrets.

---

## 3. Refunds via API

### Source
- https://docs.clover.com/reference/refundcharge (Ecommerce API)
- https://docs.clover.com/reference/createrefund (Merchant V3 API)
- https://docs.clover.com/docs/refunding-payments

### Two paths

**Path A — Ecommerce API (recommended for Hosted Checkout):**
```
POST https://scl.clover.com/v1/refunds          (production)
POST https://scl-sandbox.dev.clover.com/v1/refunds  (sandbox)
Authorization: Bearer <ECOMM_PRIVATE_TOKEN>
Content-Type: application/json

{ "charge": "CHARGE_ID_FROM_CHECKOUT", "amount": 1500, "reason": "requested_by_customer" }
```
Returns `{ id, amount, charge, status: "succeeded" | "pending" | "failed", ... }`.

**Path B — Merchant V3 API (using the Clover `payment.id`):**
```
POST https://api.clover.com/v3/merchants/{mId}/refunds
Authorization: Bearer <MERCHANT_API_TOKEN>

{ "payment": { "id": "<paymentId>" }, "amount": 1500 }
```

### For our flow
Hosted Checkout produces both a Clover `payment` and (if Ecomm-routed) a `charge`. Use **Path A** with the ECOMM private token because:
- Token scope is app-level (one token across all merchants the app is installed on, exchanged via OAuth).
- Partial refunds are first-class.
- Idempotency via `Idempotency-Key` header is supported.

**Both full and partial refunds are supported via API.** Dashboard-only is *not* a constraint.

### Limits
- Refund window: bound by the merchant's processor settlement rules (typically up to 60–120 days post-capture; varies by MID).
- After the original batch settles, refunds may be processed as separate ACH credits — `status` may be `pending` for hours.

---

## 4. Sandbox provisioning

### Source
- https://docs.clover.com/docs/using-the-sandbox
- https://sandbox.dev.clover.com

### Steps

1. **Create developer account** at https://sandbox.dev.clover.com (separate from production https://clover.com/developers).
2. **Create a test merchant** from the sandbox dashboard. Pick "US" + an Ecommerce-capable merchant plan (otherwise Hosted Checkout endpoints reject).
3. **Create an app** in the sandbox dashboard:
   - Permissions: at minimum `READ payments`, `WRITE payments`, `READ orders`, `WRITE orders`, `WRITE refunds`, `READ merchant`.
   - Site modules: enable **Ecommerce** + **Hosted Checkout**.
4. **Install the app** on your test merchant (link from app dashboard → "Install on test merchant").
5. **Generate an Ecommerce API token** (sandbox): Setup → API Tokens → Create. Save the **private** token (`pcap_…`) and **public** token (`pkcap_…`).
6. **Configure webhook URL** for your dev environment (use a Vercel preview deployment or ngrok). Echo the verification code on first GET. Save the signing secret.
7. **Test card**: Clover sandbox accepts `4761 7300 0000 0043` (Discover) and `6011 3610 0000 0006` for success scenarios; failure cards documented at https://docs.clover.com/docs/testing-ecommerce-payments.

### Required credentials at minimum
| Variable | Where to get it |
|---|---|
| `CLOVER_APP_ID` | Sandbox app dashboard |
| `CLOVER_APP_SECRET` | Sandbox app dashboard (OAuth flow) |
| `CLOVER_ECOMM_PRIVATE_TOKEN` | Setup → API Tokens (sandbox) |
| `CLOVER_ECOMM_PUBLIC_TOKEN` | Setup → API Tokens (sandbox) |
| `CLOVER_WEBHOOK_SECRET` | Generated when webhook URL is verified |
| `CLOVER_MERCHANT_ID` | Test merchant id (per-environment) |
| `CLOVER_API_BASE` | `https://sandbox.dev.clover.com` (sandbox) / `https://clover.com` (prod) |
| `CLOVER_ECOMM_BASE` | `https://scl-sandbox.dev.clover.com` (sandbox) / `https://scl.clover.com` (prod) |

---

## Implementation impact on issues #9, #10, #14

**#9 (payment success):** rename mental model from `payment.succeeded` to "CREATE on object type `P` with `result === 'SUCCESS'` after a follow-up GET." The webhook handler should not trust the webhook payload alone — always re-fetch the payment.

**#10 (payment failure):** **the webhook may never fire** for declines. Implement a return-URL handler that calls `GET /invoicingcheckoutservice/v1/checkouts/{sessionId}` and reconciles state. Treat the webhook as a "happy-path corroboration," not the source of truth for failures.

**#14 (refunds):** API-driven refunds are fully supported. Use the Ecommerce `POST /v1/refunds` endpoint with the stored `charge` id. Inbound refund webhooks (object type `R`) confirm completion asynchronously.

---

## Open follow-ups (file as new issues if confirmed)

1. **Hosted Checkout failure semantics** — confirm in sandbox whether decline ever produces a `P:CREATE` webhook with `result: FAIL`, or only the return-URL surfaces it. If "return-URL only," we need a reconciliation route on top of #10.
2. **Refund webhook payload** — capture an actual `R` event from sandbox to confirm `payment.id` correlation field name (some Clover docs say `paymentRef`, others `payment.id`).
3. **Idempotency on refunds** — verify `Idempotency-Key` header is honored on `POST /v1/refunds` in sandbox before relying on it in #14.

---

## References

- Webhooks overview: https://docs.clover.com/docs/webhooks
- Webhook events + payload: https://docs.clover.com/docs/webhook-events-and-payload
- Configure webhooks: https://docs.clover.com/docs/configure-webhooks
- Hosted Checkout: https://docs.clover.com/docs/using-checkout-api
- Ecommerce refunds: https://docs.clover.com/reference/refundcharge
- Merchant V3 refunds: https://docs.clover.com/reference/createrefund
- Sandbox: https://docs.clover.com/docs/using-the-sandbox
- Test cards: https://docs.clover.com/docs/testing-ecommerce-payments
