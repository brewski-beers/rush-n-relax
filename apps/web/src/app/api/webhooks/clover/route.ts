import { NextResponse } from 'next/server';

/**
 * Clover webhook handler — NO-OP STUB.
 *
 * Rush N Relax runs Path B (merchant-issued private API token, not a
 * Developer App), so app-level webhooks are not configured. Payment
 * confirmation flows through the return URL at
 * `/order/{id}/return` (see #279) plus the `reconcileAwaitingPaymentOrders`
 * recovery cron in `functions/index.ts`.
 *
 * This route is preserved as a placeholder for the eventual Path A upgrade
 * (#302 — TBB-built Clover App with OAuth install + per-app webhook
 * secret). Until then, every inbound POST is acknowledged with `received:
 * true, handled: false` so any misconfigured caller does not retry forever.
 */
export function POST(): NextResponse {
  return NextResponse.json({ received: true, handled: false });
}
