import { NextResponse } from 'next/server';

/**
 * POST /api/checkout/session — STUB.
 *
 * The previous implementation guarded on `OrderStatus === 'id_verified'` and
 * transitioned to `awaiting_payment` — both states removed in #362. The
 * full rewrite (cart → CheckoutSession → Clover) lands in #364. Until then
 * this returns 410 Gone so the old flow cannot be initiated.
 */
export function POST(): NextResponse {
  return NextResponse.json(
    {
      error:
        'Checkout session endpoint is being rewritten (#364). Pre-payment flow no longer uses OrderStatus.',
    },
    { status: 410 }
  );
}
