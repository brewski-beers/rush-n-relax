import { NextResponse } from 'next/server';

/**
 * POST /api/order/start — DEPRECATED.
 *
 * Removed in #362 as part of the checkout-flow rewrite. The pre-payment
 * lifecycle (cart → AgeChecker → Clover) now lives on `CheckoutSession`,
 * not `Order`. Order documents are created only after a successful Clover
 * payment via the new return-URL handler (see #368).
 *
 * This stub returns 410 Gone so any lingering callers fail loudly. The
 * route file itself is removed in #372.
 */
export function POST(): NextResponse {
  return NextResponse.json(
    {
      error:
        'This endpoint has been removed. Use the new CheckoutSession flow (see #364, #368).',
    },
    { status: 410 }
  );
}
