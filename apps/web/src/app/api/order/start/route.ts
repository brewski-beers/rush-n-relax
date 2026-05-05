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
  /**
   * Verification id returned by the AgeChecker test-mode simulate modal.
   * **Optional** — only present in test mode where the cart short-circuits
   * the popup. In live mode the request omits this field; the order is
   * created in `pending_id_verification` and the inbound webhook drives
   * the state machine + inventory decrement.
   */
  verificationId?: string;
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
 * Two execution paths, gated by presence of `verificationId`:
 *
 *  - **Test-mode path** (verificationId present): the simulate modal already
 *    returned a `pass` outcome. We create the order directly in
 *    `id_verified`, persist the verificationId, and decrement inventory
 *    inline (mirroring the webhook handler's post-`id_verified` work).
 *
 *  - **Live path** (verificationId absent): the AgeChecker popup will run
 *    AFTER this call, on the order page. We create the order in
 *    `pending_id_verification` and stop. The `/api/webhooks/agechecker`
 *    handler is responsible for the `id_verified` transition AND the
 *    inventory decrement when the popup completes server-side.
 *
 * Both paths re-check shipping eligibility server-side first.
 *
 * Returns `{ orderId }`. The client redirects to `/order/[id]` where the
 * existing `OrderStatusPoller` (and, in live mode, `<AgeCheckerLiveButton>`)
 * take over.
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

  if (!body.items?.length) {
    return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
  }

  const hasVerification =
    typeof body.verificationId === 'string' && body.verificationId.length > 0;

  const orderId = await createOrder({
    items: body.items,
    subtotal: body.subtotal,
    tax: body.tax,
    total: body.total,
    locationId: body.locationId,
    deliveryAddress: body.deliveryAddress,
    status: hasVerification ? 'id_verified' : 'pending_id_verification',
    customerEmail: body.customerEmail,
  });

  if (hasVerification) {
    // Test-mode path: persist the verificationId for audit + webhook
    // correlation, then decrement inventory inline.
    await setOrderProviderRefs(orderId, {
      // verificationId presence already validated above.
      agecheckerSessionId: body.verificationId as string,
    });

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
  }

  return NextResponse.json({ orderId });
}
