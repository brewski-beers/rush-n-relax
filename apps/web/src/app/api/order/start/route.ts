import { NextRequest, NextResponse } from 'next/server';
import {
  createOrder,
  decrementInventoryItems,
  InsufficientStockError,
  setOrderProviderRefs,
} from '@/lib/repositories';
import { canShipToState, getShippingBlockReason } from '@/constants/shipping';
import type { OrderItem, ShippingAddress } from '@/types';

interface StartRequest {
  /** Verification id returned by the AgeChecker widget (pass outcome). */
  verificationId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  locationId: string;
  deliveryAddress: ShippingAddress;
  customerEmail?: string;
}

/**
 * POST /api/order/start
 *
 * Called by the cart AFTER the AgeChecker widget has returned a `pass`
 * outcome with a `verificationId`. We:
 *
 *   1. Re-check shipping eligibility server-side (defense in depth, BEFORE
 *      any other work) — 422 if the state is blocked.
 *   2. Validate the cart payload.
 *   3. Create the order directly in `id_verified` (skipping the
 *      `pending_id_verification` placeholder — the user has already passed
 *      verification by the time this is called).
 *   4. Decrement inventory atomically (mirrors the webhook handler's
 *      post-`id_verified` behavior so the inventory contract is unchanged).
 *   5. Persist the agechecker verificationId on the order for the audit
 *      trail and so the inbound webhook can correlate retries.
 *
 * Returns `{ orderId }`. The client redirects to `/order/[id]` where the
 * existing `OrderStatusPoller` triggers Clover hosted checkout.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: StartRequest;
  try {
    body = (await req.json()) as StartRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Shipping eligibility — checked FIRST so blocked states can never reach
  // any further work (no order doc, no inventory write).
  const addr = body.deliveryAddress;
  if (!addr?.state) {
    return NextResponse.json(
      { error: 'Delivery address with state is required.' },
      { status: 400 }
    );
  }
  if (!canShipToState(addr.state)) {
    return NextResponse.json(
      {
        error:
          getShippingBlockReason(addr.state) ?? 'Cannot ship to this state.',
      },
      { status: 422 }
    );
  }

  if (!body.verificationId || typeof body.verificationId !== 'string') {
    return NextResponse.json(
      { error: 'Missing AgeChecker verificationId.' },
      { status: 400 }
    );
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
  }

  const orderId = await createOrder({
    items: body.items,
    subtotal: body.subtotal,
    tax: body.tax,
    total: body.total,
    locationId: body.locationId,
    deliveryAddress: body.deliveryAddress,
    status: 'id_verified',
    customerEmail: body.customerEmail,
  });

  // Persist the verificationId for audit + webhook correlation. We reuse
  // the `agecheckerSessionId` slot — same provider id, same field — to
  // avoid a schema migration just for the rename.
  await setOrderProviderRefs(orderId, {
    agecheckerSessionId: body.verificationId,
  });

  // Inventory decrement is the responsibility of the id_verified
  // transition. Because we created the order directly in id_verified
  // (bypassing the transitionStatus path that the webhook uses), we have
  // to decrement inline here to preserve the existing contract.
  try {
    await decrementInventoryItems(
      body.locationId,
      body.items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
      }))
    );
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return NextResponse.json(
        {
          error: 'Insufficient stock',
          productId: err.productId,
          available: err.available,
          requested: err.requested,
        },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ orderId });
}
