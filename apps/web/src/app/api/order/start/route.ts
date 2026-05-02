import { NextRequest, NextResponse } from 'next/server';
import { createOrder, setOrderProviderRefs } from '@/lib/repositories';
import { startAgeCheckerSession } from '@/lib/agechecker';
import { canShipToState, getShippingBlockReason } from '@/constants/shipping';
import type { OrderItem, ShippingAddress } from '@/types';

interface StartRequest {
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
 * Creates an order in `pending_id_verification`, kicks off an AgeChecker
 * hosted-verification session, persists the session id, and returns the
 * AgeChecker redirect URL. This is the first leg of the storefront flow;
 * the ID-verification webhook later transitions the order to `id_verified`.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: StartRequest;
  try {
    body = (await req.json()) as StartRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
  }

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

  const orderId = await createOrder({
    items: body.items,
    subtotal: body.subtotal,
    tax: body.tax,
    total: body.total,
    locationId: body.locationId,
    deliveryAddress: body.deliveryAddress,
    status: 'pending_id_verification',
    customerEmail: body.customerEmail,
  });

  const origin = new URL(req.url).origin;
  const session = await startAgeCheckerSession({
    orderId,
    customerEmail: body.customerEmail,
    returnUrl: `${origin}/order/${orderId}`,
  });

  await setOrderProviderRefs(orderId, {
    agecheckerSessionId: session.sessionId,
  });

  return NextResponse.json({
    orderId,
    agecheckerRedirectUrl: session.redirectUrl,
    provider: session.provider,
  });
}
