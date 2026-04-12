# Redde Payments API

> Research source: public Redde developer documentation and integration guides (April 2026).
> Fields marked **KB TO VERIFY** require KB to log into https://developers.reddedashboard.com and confirm.

---

## Base URL

```
https://api.reddedashboard.com/v1
```

**KB TO VERIFY** — confirm exact base URL and version prefix from the developer portal.

---

## Authentication

Redde uses API key authentication passed as a request header.

```http
Authorization: Bearer <REDDE_API_KEY>
Content-Type: application/json
```

**KB TO VERIFY** — confirm the header name (`Authorization: Bearer` vs a custom header like `X-Redde-Api-Key`) and whether the key is obtained per-merchant from the dashboard.

---

## Sandbox / Test Environment

**KB TO VERIFY** — confirm:

- Sandbox base URL (likely `https://sandbox.reddedashboard.com/v1` or similar)
- How to obtain test credentials (dashboard toggle or separate account)
- Test card numbers / phone numbers for payment simulation

---

## Endpoints

### Initiate Payment

Creates a payment transaction and returns a hosted payment URL to redirect the customer to.

```
POST /transactions/initiate
```

**Request body:**

```json
{
  "amount": 4999,
  "currency": "USD",
  "orderId": "ord_abc123",
  "description": "Rush N Relax order",
  "customerEmail": "customer@example.com",
  "callbackUrl": "https://rush-n-relax.com/api/redde/webhook",
  "successUrl": "https://rush-n-relax.com/order/ord_abc123",
  "cancelUrl": "https://rush-n-relax.com/cart"
}
```

| Field           | Type     | Notes                                                              |
| --------------- | -------- | ------------------------------------------------------------------ |
| `amount`        | `number` | Amount in **cents** (or smallest currency unit) — **KB TO VERIFY** |
| `currency`      | `string` | ISO 4217 — `"USD"`                                                 |
| `orderId`       | `string` | Merchant-supplied reference ID                                     |
| `description`   | `string` | Shown on the payment page                                          |
| `customerEmail` | `string` | Optional; pre-fills payment form                                   |
| `callbackUrl`   | `string` | Redde POSTs webhook events here                                    |
| `successUrl`    | `string` | Redirect after successful payment                                  |
| `cancelUrl`     | `string` | Redirect if customer cancels                                       |

**KB TO VERIFY** — confirm exact field names, whether `amount` is cents or dollars, and any required vs optional fields.

**Response:**

```json
{
  "txnId": "rde_txn_xyz789",
  "paymentUrl": "https://pay.reddedashboard.com/checkout/rde_txn_xyz789",
  "status": "pending",
  "expiresAt": "2026-04-12T14:00:00Z"
}
```

**KB TO VERIFY** — confirm `txnId` and `paymentUrl` field names.

---

### Void Transaction

Voids a pending/authorized transaction before it settles.

```
POST /transactions/{txnId}/void
```

**Request body:** empty `{}`

**Response:**

```json
{
  "txnId": "rde_txn_xyz789",
  "status": "voided"
}
```

**KB TO VERIFY** — confirm endpoint path and whether void requires a body.

---

### Refund Transaction

Issues a full or partial refund on a settled transaction.

```
POST /transactions/{txnId}/refund
```

**Request body:**

```json
{
  "amount": 4999,
  "reason": "Customer requested refund"
}
```

| Field    | Type     | Notes                                                           |
| -------- | -------- | --------------------------------------------------------------- |
| `amount` | `number` | Refund amount in cents; omit for full refund — **KB TO VERIFY** |
| `reason` | `string` | Optional memo                                                   |

**Response:**

```json
{
  "txnId": "rde_txn_xyz789",
  "refundId": "rde_ref_abc001",
  "status": "refunded",
  "amount": 4999
}
```

**KB TO VERIFY** — confirm partial refund support and field names.

---

## Webhook Events

Redde sends `POST` requests to the `callbackUrl` provided at transaction initiation.

### Signature Verification

**KB TO VERIFY** — confirm the exact signature mechanism. Expected pattern (common for payment APIs):

```
X-Redde-Signature: sha256=<hmac-hex>
```

The HMAC is computed over the raw request body using `REDDE_WEBHOOK_SECRET` as the key.

Verification algorithm (Node.js):

```ts
import { createHmac, timingSafeEqual } from 'crypto';

function verifyReddeSignature(
  rawBody: Buffer,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  const [algo, digest] = signatureHeader.split('=');
  if (algo !== 'sha256' || !digest) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(
      Buffer.from(digest, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}
```

**KB TO VERIFY** — confirm header name (`X-Redde-Signature`), algorithm, and signing key source.

---

### Event: `payment.paid`

Payment successfully completed.

```json
{
  "event": "payment.paid",
  "txnId": "rde_txn_xyz789",
  "orderId": "ord_abc123",
  "amount": 4999,
  "currency": "USD",
  "paidAt": "2026-04-12T13:45:00Z",
  "customerEmail": "customer@example.com"
}
```

**KB TO VERIFY** — confirm event name (`payment.paid` vs `transaction.success` or `paid`) and full payload shape.

---

### Event: `payment.failed`

Payment was declined or failed.

```json
{
  "event": "payment.failed",
  "txnId": "rde_txn_xyz789",
  "orderId": "ord_abc123",
  "amount": 4999,
  "currency": "USD",
  "failedAt": "2026-04-12T13:46:00Z",
  "failureReason": "insufficient_funds"
}
```

**KB TO VERIFY** — confirm event name and `failureReason` enum values.

---

### Event: `payment.voided`

Transaction was voided.

```json
{
  "event": "payment.voided",
  "txnId": "rde_txn_xyz789",
  "orderId": "ord_abc123",
  "amount": 4999,
  "currency": "USD",
  "voidedAt": "2026-04-12T13:47:00Z"
}
```

---

### Event: `payment.refunded`

Refund issued on a settled transaction.

```json
{
  "event": "payment.refunded",
  "txnId": "rde_txn_xyz789",
  "orderId": "ord_abc123",
  "refundId": "rde_ref_abc001",
  "amount": 4999,
  "currency": "USD",
  "refundedAt": "2026-04-12T13:48:00Z"
}
```

---

## KB Checklist Before Merging Payment Code

- [ ] Confirm base URL and sandbox URL
- [ ] Confirm auth header format and key location in dashboard
- [ ] Confirm `initiatePayment` request/response field names (especially `amount` unit: cents vs dollars)
- [ ] Confirm webhook signature header name and algorithm
- [ ] Confirm event type strings (`payment.paid`, etc.)
- [ ] Obtain sandbox API key and test credentials
- [ ] Set Firebase Secret: `firebase functions:secrets:set REDDE_API_KEY`
- [ ] Set Next.js env var: `REDDE_WEBHOOK_SECRET` (in Vercel environment variables)
