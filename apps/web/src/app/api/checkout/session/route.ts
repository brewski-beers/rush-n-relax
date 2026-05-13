import { NextRequest, NextResponse } from 'next/server';
import {
  createCheckoutSession,
  type CreateCheckoutSessionInput,
} from '@/lib/repositories/checkout-session.repository';
import {
  holdStock,
  releaseStock,
  InsufficientStockError,
  type HoldRequest,
} from '@/lib/repositories';
import { createCloverCheckoutSession } from '@/lib/clover/checkout';
import { canShipToState, getShippingBlockReason } from '@/constants/shipping';
import { getLocationBySlug } from '@/constants/locations';
import { ONLINE_LOCATION_ID } from '@/constants/location-ids';
import {
  priceCart,
  StaleCartError,
  type PricedCart,
} from '@/lib/checkout/priceCart';
import type { ShippingAddress } from '@/types';

/**
 * Cart line as received from the browser. We trust ONLY `productId`,
 * `variantId`, and `quantity` — all money fields are recomputed server-side
 * (see {@link priceCart}). The legacy `subtotal` / `tax` / `total` /
 * per-line `unitPrice` fields may still be present on the wire (the cart UI
 * sends them for its own estimate) but the server ignores them.
 */
interface SessionRequestLine {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface SessionRequestBody {
  items: SessionRequestLine[];
  /** Client-side estimates — ignored by the server; used only for a
   *  best-effort drift warning. */
  subtotal?: number;
  tax?: number;
  total?: number;
  locationId: string;
  deliveryAddress: ShippingAddress;
  customerEmail?: string;
}

/**
 * POST /api/checkout/session — rewritten in #364.
 *
 * Single endpoint that replaces the legacy /api/order/start +
 * pre-#362 /api/checkout/session pair. Flow:
 *
 *   1. Validate payload (cart, address, locationId).
 *   2. Server-side shipping eligibility check (defense in depth).
 *   3. Re-price the cart server-side — recompute unit prices / subtotal /
 *      tax / total from current product data; client-supplied money fields
 *      are ignored. A stale cart (missing product/variant) 400s here.
 *   4. Atomically hold stock for the cart — short-circuit 409 on shortage.
 *   5. Mint a Clover Hosted Checkout session for the server-computed total.
 *      On failure, RELEASE holds so we never leave reserved stock dangling.
 *      The Clover return URL is built from `checkoutSessionId` — the id we
 *      generated in step 0, NOT a Clover-side template token (Clover does
 *      not substitute `{CHECKOUT_SESSION_ID}`).
 *   6. Persist a CheckoutSession doc keyed by `checkoutSessionId` (the id we
 *      generated) with Clover's own id stored as a field. Status
 *      `awaiting_id` and a 24h `expiresAt`. No Order is created
 *      at this stage — Order is born only after a successful payment
 *      (#368). VerificationId arrives later via the AgeChecker popup
 *      webhook.
 *
 * Returns `{ sessionId, redirectUrl: '/checkout/{sessionId}/verify' }`.
 */
const HOLD_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: SessionRequestBody;
  try {
    body = (await req.json()) as SessionRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── Validate payload ───────────────────────────────────────────────
  if (!body.items?.length) {
    return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
  }
  if (!body.locationId || typeof body.locationId !== 'string') {
    return NextResponse.json(
      { error: 'locationId is required.' },
      { status: 400 }
    );
  }
  // #audit M3 — reject a made-up locationId before holding stock against it.
  if (
    body.locationId !== ONLINE_LOCATION_ID &&
    getLocationBySlug(body.locationId) === undefined
  ) {
    return NextResponse.json(
      { error: `Unknown locationId '${body.locationId}'.` },
      { status: 400 }
    );
  }
  const addr = body.deliveryAddress;
  if (!addr?.state) {
    return NextResponse.json(
      { error: 'Delivery address with state is required.' },
      { status: 400 }
    );
  }

  // ── Shipping eligibility (defense in depth) ────────────────────────
  if (!canShipToState(addr.state)) {
    return NextResponse.json(
      {
        error:
          getShippingBlockReason(addr.state) ?? 'Cannot ship to this state.',
      },
      { status: 422 }
    );
  }

  // ── Re-price the cart server-side (defense in depth) ───────────────
  // The client sends only (productId, variantId, quantity); we recompute
  // unit prices, subtotal, tax, and total from current product data so a
  // tampered request can't dictate the amount charged. Done BEFORE the
  // stock hold so a stale cart 400s without leaving reserved stock behind.
  if (
    body.items.some(it => !Number.isInteger(it.quantity) || it.quantity < 1)
  ) {
    return NextResponse.json(
      { error: 'Every cart line needs a positive integer quantity.' },
      { status: 400 }
    );
  }

  let priced: PricedCart;
  try {
    priced = await priceCart(
      body.items.map(it => ({
        productId: it.productId,
        variantId: it.variantId || 'default',
        quantity: it.quantity,
      })),
      body.locationId
    );
  } catch (err) {
    if (err instanceof StaleCartError) {
      return NextResponse.json(
        {
          error: err.message,
          reason: 'stale_cart',
          productId: err.productId,
          variantId: err.variantId,
        },
        { status: 400 }
      );
    }
    throw err;
  }

  // Best-effort drift warning — surfaces a stale cart UI. The server's
  // computed total is authoritative regardless.
  if (
    typeof body.total === 'number' &&
    Math.abs(body.total - priced.total) > 1
  ) {
    console.warn('[checkout/session] client/server total mismatch', {
      clientTotal: body.total,
      serverTotal: priced.total,
    });
  }

  // ── Build holds from the re-priced cart ────────────────────────────
  const holds: HoldRequest[] = priced.items.map(it => ({
    productId: it.productId,
    variantId: it.variantId,
    locationId: body.locationId,
    qty: it.quantity,
  }));

  // ── Step 1: hold stock atomically. 409 on shortage. ────────────────
  try {
    await holdStock(holds, { source: 'order', reason: 'checkout-session' });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return NextResponse.json(
        {
          error: 'Insufficient stock',
          productId: err.productId,
          variantId: err.variantId,
          locationId: err.locationId,
          available: err.available,
          requested: err.requested,
        },
        { status: 409 }
      );
    }
    throw err;
  }

  // ── Step 2: mint Clover Hosted Checkout session. ───────────────────
  // `checkoutSessionId` is the id we generate up front and use for BOTH
  // the CheckoutSession Firestore doc id AND the Clover return URL.
  // Clover does NOT substitute `{CHECKOUT_SESSION_ID}` in
  // `redirectUrls.success` (confirmed live — the customer landed on
  // `/order/%7BCHECKOUT_SESSION_ID%7D/return`), so the return URL must be
  // deterministic at create time. The only id we control then is this one.
  const checkoutSessionId = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  let cloverSession;
  try {
    cloverSession = await createCloverCheckoutSession({
      sessionId: checkoutSessionId,
      amount: priced.total,
      tax: priced.tax,
      ...(body.customerEmail ? { customerEmail: body.customerEmail } : {}),
      items: priced.items,
      // Prefill Clover's hosted-checkout customer object with the buyer
      // name the customer already entered in our cart.
      deliveryAddress: body.deliveryAddress,
    });
  } catch (err) {
    // Clover failed — release the holds we just took so reserved stock
    // does not leak. Swallow release errors; the cron sweep will clean
    // up any orphans on the 24h `expiresAt` boundary.
    try {
      await releaseStock(holds, {
        source: 'order',
        reason: 'clover-failure-rollback',
      });
    } catch {
      // intentional: never mask the original Clover error
    }
    throw err;
  }

  // The stub provider does not return a real Clover session id; fall back
  // to our generated id so the field is always populated. Production with
  // the kill switch ON always returns a Clover-issued id.
  const cloverCheckoutSessionId =
    cloverSession.cloverCheckoutSessionId ?? checkoutSessionId;

  // ── Step 3: persist CheckoutSession doc. ───────────────────────────
  const now = Date.now();
  const expiresAt = new Date(now + HOLD_TTL_MS);

  const createInput: CreateCheckoutSessionInput = {
    id: checkoutSessionId,
    items: priced.items,
    subtotal: priced.subtotal,
    tax: priced.tax,
    total: priced.total,
    locationId: body.locationId,
    deliveryAddress: body.deliveryAddress,
    holds: holds.map(h => ({
      productId: h.productId,
      variantId: h.variantId,
      locationId: h.locationId,
      qty: h.qty,
    })),
    cloverCheckoutSessionId,
    ...(cloverSession.redirectUrl
      ? { cloverCheckoutUrl: cloverSession.redirectUrl }
      : {}),
    expiresAt,
    ...(body.customerEmail ? { customerEmail: body.customerEmail } : {}),
  };

  let sessionId: string;
  try {
    sessionId = await createCheckoutSession(createInput);
  } catch (err) {
    // Persistence failed — release holds to avoid leaking reserved stock.
    try {
      await releaseStock(holds, {
        source: 'order',
        reason: 'persistence-failure-rollback',
      });
    } catch {
      // intentional
    }
    throw err;
  }

  return NextResponse.json({
    sessionId,
    redirectUrl: `/checkout/${sessionId}/verify`,
  });
}
