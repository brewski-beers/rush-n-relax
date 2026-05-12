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
import type { OrderItem, ShippingAddress } from '@/types';

interface SessionRequestBody {
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
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
 *   3. Atomically hold stock for the cart — short-circuit 409 on shortage.
 *   4. Mint a Clover Hosted Checkout session. On failure, RELEASE holds
 *      so we never leave reserved stock dangling.
 *   5. Persist a CheckoutSession doc keyed by the Clover session id with
 *      status `awaiting_id` and a 24h `expiresAt`. No Order is created
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

  // ── Build holds from cart ──────────────────────────────────────────
  const holds: HoldRequest[] = body.items.map(it => ({
    productId: it.productId,
    variantId: it.variantId || 'default',
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
  // Use a synthetic orderId derived from time — no real Order exists
  // until payment success. Clover only needs an opaque correlation
  // string for its return URL.
  const provisionalOrderId = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  let cloverSession;
  try {
    cloverSession = await createCloverCheckoutSession({
      orderId: provisionalOrderId,
      amount: body.total,
      ...(body.customerEmail ? { customerEmail: body.customerEmail } : {}),
      items: body.items,
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

  // The stub provider does not return a real session id; fall back to
  // the provisional one so CheckoutSession docs are still uniquely keyed
  // in dev/preview. Production with the kill switch ON always returns
  // a Clover-issued id.
  const cloverCheckoutSessionId =
    cloverSession.cloverCheckoutSessionId ?? provisionalOrderId;

  // ── Step 3: persist CheckoutSession doc. ───────────────────────────
  const now = Date.now();
  const expiresAt = new Date(now + HOLD_TTL_MS);

  const createInput: CreateCheckoutSessionInput = {
    items: body.items,
    subtotal: body.subtotal,
    tax: body.tax,
    total: body.total,
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
