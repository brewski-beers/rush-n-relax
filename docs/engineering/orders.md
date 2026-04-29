# Orders

> Source of truth: `apps/web/src/types/order.ts` + `apps/web/src/lib/repositories/order.repository.ts`.
> Update this doc whenever either file changes (project Doc Update Rule).

## Fulfillment model

Orders are **delivery-only**. There is no in-store pickup at checkout — the
`fulfillmentType` field has been removed. `locationId` is retained as the
fulfillment origin (typically `'online'` for the storefront).

## Required fields on create

| Field              | Type             | Notes                                    |
| ------------------ | ---------------- | ---------------------------------------- |
| `items`            | `OrderItem[]`    | non-empty                                |
| `subtotal`/`tax`/`total` | cents       |                                          |
| `locationId`       | `string`         | fulfillment origin slug                  |
| `deliveryAddress`  | `ShippingAddress`| required (delivery-only)                 |
| `status`           | `OrderStatus`    | usually `awaiting_payment` on POST       |
| `agecheckerSessionId` | `string?`     | set when AgeChecker confirmed pre-pay    |

## Status lifecycle

```
pending_id_verification
        │
        ├─► id_verified ─► awaiting_payment ─► paid ─► preparing ─► out_for_delivery ─► completed
        │                                       │                                          │
        │                                       └─► refunded                               └─► refunded
        ├─► id_rejected ─► cancelled
        └─► failed ─► cancelled
```

The full table of legal moves lives in `ALLOWED_TRANSITIONS` (exported from
`order.ts`). Any update path that mutates `status` MUST consult this table.

## Lifecycle timestamps

Stamped by `updateOrderStatus` when the destination state matches:

| Status              | Timestamp field   |
| ------------------- | ----------------- |
| `paid`              | `paidAt`          |
| `preparing`         | `preparingAt`     |
| `out_for_delivery`  | `dispatchedAt`    |
| `completed`         | `completedAt`     |
| `cancelled`         | `cancelledAt`     |
| `refunded`          | `refundedAt`      |

## Provider references

| Field                     | Meaning                                              |
| ------------------------- | ---------------------------------------------------- |
| `agecheckerSessionId`     | AgeChecker verification session (pre-payment).       |
| `cloverCheckoutSessionId` | Clover Hosted Checkout session id.                   |
| `cloverPaymentId`         | Clover payment id, set on capture from webhook.      |

## Webhook → status mapping (Clover)

| Event                | Status      |
| -------------------- | ----------- |
| `payment.succeeded`  | `paid`      |
| `payment.failed`     | `failed`    |
| `payment.refunded`   | `refunded`  |
| `payment.voided`     | `cancelled` |

## Firestore indexes

`(status ASC, createdAt DESC)` — admin order queues filter-by-status and
sort newest-first. Defined in `firestore.indexes.json`.
