import { NextResponse } from 'next/server';

/**
 * GET /order/[id]/return — STUB.
 *
 * Previous handler reconciled `awaiting_payment` orders against Clover.
 * Both `awaiting_payment` and `failed` were removed from `OrderStatus` in
 * #362. The replacement is `/api/checkout/[sessionId]/redirect` (#366) +
 * the CheckoutSession→Order creation step (#368). Until those land, this
 * route redirects to the storefront so users do not see a broken page.
 */
export function GET(): NextResponse {
  return NextResponse.redirect(new URL('/', 'https://rushnrelaxshop.com'));
}
