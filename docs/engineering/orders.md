# Orders — Engineering Reference

> Covers the `orders` Firestore collection: data model, repository API, and the order confirmation flow.

---

## Firestore Collection

**Path:** `orders/{orderId}`

Auto-generated document IDs. All reads and writes go through `src/lib/repositories/order.repository.ts` — no inline Firestore access elsewhere.

### Schema

| Field | Type | Notes |
|---|---|---|
| `items` | `OrderItem[]` | Line items (product ID, name, qty, unit price, line total) |
| `subtotal` | `number` | Cents |
| `tax` | `number` | Cents |
| `total` | `number` | Cents |
| `locationId` | `string` | Slug of the pickup/ship-from location |
| `fulfillmentType` | `'pickup' \| 'shipping'` | |
| `status` | `OrderStatus` | See status lifecycle below |
| `customerEmail` | `string?` | Optional |
| `createdAt` | `Timestamp` | Set on create |
| `updatedAt` | `Timestamp` | Updated on every status change |

**Note:** No payment-processor-specific fields are stored on `Order`. A generic payment reference field will be added when Clover integration is built.

### Status Lifecycle

```
pending → processing → paid
                    ↘ failed
         voided
         refunded
```

---

## Repository API (`src/lib/repositories/order.repository.ts`)

| Function | Signature | Description |
|---|---|---|
| `createOrder` | `(data: Omit<Order, 'id' \| 'createdAt' \| 'updatedAt'>) => Promise<string>` | Creates doc, returns new ID |
| `getOrder` | `(id: string) => Promise<Order \| null>` | Returns null if not found |
| `updateOrderStatus` | `(id: string, status: OrderStatus) => Promise<void>` | Always sets `updatedAt` |

Types are exported from `src/types/order.ts` and re-exported from `src/types/index.ts`.

---

## Order Confirmation Page

**Route:** `/order/[id]` — `src/app/(storefront)/order/[id]/page.tsx`

Server component that reads the order via `getOrder()`. Delegates status polling to `OrderStatusPoller` (client island).

| Status | UI |
|---|---|
| `pending` / `processing` | Spinner + polling every 5s, max 30s |
| `paid` | Green confirmation, items table, "Continue Shopping" CTA, clears cart |
| `failed` | Error message, "Return to Cart" link |
| `voided` / `refunded` | Informational message |

**API route:** `GET /api/order/[id]/status` — returns `{ status: OrderStatus }` only. No internal fields exposed to the client.
