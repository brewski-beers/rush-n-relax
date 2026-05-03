import { NextRequest, NextResponse } from 'next/server';
import {
  getOrder,
  setOrderProviderRefs,
  transitionStatus,
  InvalidTransitionError,
} from '@/lib/repositories';
import { createCloverCheckoutSession } from '@/lib/clover/checkout';

interface CheckoutRequest {
  orderId: string;
}

/**
 * POST /api/checkout/session
 *
 * Second leg of the storefront flow. Only callable once the order is
 * `id_verified` (AgeChecker webhook fired). Transitions the order to
 * `awaiting_payment`, opens a Clover hosted-checkout session, persists the
 * Clover session id, and returns the redirect URL.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CheckoutRequest;
  try {
    body = (await req.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.orderId) {
    return NextResponse.json(
      { error: 'orderId is required.' },
      { status: 400 }
    );
  }

  const order = await getOrder(body.orderId);
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  if (order.status !== 'id_verified') {
    return NextResponse.json(
      {
        error: `Order is in status "${order.status}"; payment can only be initiated once ID is verified.`,
      },
      { status: 409 }
    );
  }

  try {
    await transitionStatus(order.id, 'awaiting_payment', 'system');
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  const session = await createCloverCheckoutSession({
    orderId: order.id,
    amount: order.total,
    customerEmail: order.customerEmail,
    lineItems: order.items.map(it => ({
      name: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    })),
  });

  await setOrderProviderRefs(order.id, {
    cloverCheckoutSessionId: session.sessionId,
  });

  return NextResponse.json({
    orderId: order.id,
    redirectUrl: session.redirectUrl,
    provider: session.provider,
  });
}
