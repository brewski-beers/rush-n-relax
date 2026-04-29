import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '@/lib/repositories/order.repository';
import { createCloverCheckoutSession } from '@/lib/clover/checkout';
import { canShipToState, getShippingBlockReason } from '@/constants/shipping';
import type { OrderItem, ShippingAddress } from '@/types';

interface CheckoutRequest {
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  locationId: string;
  /** Required — orders are delivery-only. */
  deliveryAddress: ShippingAddress;
  /** AgeChecker session id (verification confirmed pre-checkout). */
  agecheckerSessionId: string;
  customerEmail?: string;
}

export async function POST(req: NextRequest) {
  let body: CheckoutRequest;
  try {
    body = (await req.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.agecheckerSessionId) {
    return NextResponse.json(
      { error: 'Age verification is required before checkout.' },
      { status: 400 }
    );
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
          getShippingBlockReason(addr.state) ?? 'Cannot deliver to this state.',
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
    deliveryAddress: addr,
    // ID was just verified via AgeChecker; payment session follows.
    status: 'awaiting_payment',
    agecheckerSessionId: body.agecheckerSessionId,
    customerEmail: body.customerEmail,
  });

  const session = await createCloverCheckoutSession({
    orderId,
    amount: body.total,
    customerEmail: body.customerEmail,
  });

  return NextResponse.json({
    orderId,
    redirectUrl: session.redirectUrl,
    provider: session.provider,
  });
}
