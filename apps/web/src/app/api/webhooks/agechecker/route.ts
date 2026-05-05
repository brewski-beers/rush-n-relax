import { NextResponse } from 'next/server';

/**
 * AgeChecker webhook — STUB.
 *
 * Previous handler drove `pending_id_verification → id_verified|id_rejected`,
 * all of which were removed in #362. The replacement webhook (which marks
 * `CheckoutSession.ageVerifiedAt` instead) lands in #367.
 *
 * Returns 200 to keep AgeChecker from retrying while the rewrite is in
 * flight. No state is mutated.
 */
export function POST(): NextResponse {
  return NextResponse.json({
    received: true,
    handled: false,
    deprecated: true,
  });
}
