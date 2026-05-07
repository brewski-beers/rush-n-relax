'use server';

/**
 * Preview-only simulate actions for /checkout/[sessionId]/verify (#411).
 *
 * AgeChecker's "Add Site" feature mints a NEW API key per registered
 * domain. Vercel preview deploys produce ephemeral URLs (e.g.
 * `rnr-abc123.vercel.app`) — registering each one would be unworkable.
 *
 * These actions let KB exercise the full checkout chain on preview
 * deploys (and local dev) by short-circuiting the AgeChecker popup.
 * They are gated by `VERCEL_ENV !== 'production'` server-side as
 * defense in depth — the UI also hides the buttons on prod, but the
 * action itself refuses to run if invoked in production.
 *
 * Pass: writes `ageVerifiedAt` via `markAgeVerified`, transitioning the
 *       session to `awaiting_payment`. The downstream redirect handler
 *       at `/api/checkout/[sessionId]/redirect` polls for this field
 *       and forwards to Clover.
 * Deny: marks the session `cancelled`. Stock release is handled by the
 *       reconciler cron (#369).
 */
import {
  getCheckoutSession,
  markAgeVerified,
  markCheckoutSessionCancelled,
} from '@/lib/repositories';

const SIMULATE_VERIFICATION_ID = 'simulate-preview';

function assertNonProductionEnv(): void {
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('Simulate actions disabled in production');
  }
}

export interface SimulateActionResult {
  ok: true;
}

export async function simulateAgeVerifyPass(
  sessionId: string
): Promise<SimulateActionResult> {
  assertNonProductionEnv();
  const session = await getCheckoutSession(sessionId);
  if (!session) {
    throw new Error(`CheckoutSession '${sessionId}' not found`);
  }
  // Idempotent: only flip when still in the pre-verify state. The
  // CheckoutSession transition graph forbids `awaiting_payment ->
  // awaiting_payment`, so a second click would otherwise throw.
  if (session.status === 'awaiting_id') {
    await markAgeVerified(sessionId, SIMULATE_VERIFICATION_ID, new Date());
  }
  return { ok: true };
}

export async function simulateAgeVerifyDeny(
  sessionId: string
): Promise<SimulateActionResult> {
  assertNonProductionEnv();
  const session = await getCheckoutSession(sessionId);
  if (!session) {
    throw new Error(`CheckoutSession '${sessionId}' not found`);
  }
  // Idempotent: only cancel from non-terminal states.
  if (
    session.status === 'awaiting_id' ||
    session.status === 'awaiting_payment'
  ) {
    await markCheckoutSessionCancelled(sessionId);
  }
  return { ok: true };
}
