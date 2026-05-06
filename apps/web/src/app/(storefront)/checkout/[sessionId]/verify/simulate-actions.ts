'use server';

/**
 * Preview-only simulate actions for /checkout/[sessionId]/verify (#411).
 *
 * AgeChecker's "Add Site" feature mints a NEW API key per registered
 * domain. Vercel preview deploys produce ephemeral URLs (e.g.
 * `rnr-abc123.vercel.app`) — registering each one would be unworkable.
 *
 * These actions let KB exercise the full checkout chain on preview
 * deploys by short-circuiting the AgeChecker popup. They are gated by
 * `VERCEL_ENV === 'preview'` server-side as defense in depth — the UI
 * also hides the buttons on prod, but the action itself refuses to run
 * if invoked anywhere other than a preview deploy.
 *
 * Pass: writes `ageVerifiedAt` via `markAgeVerified`, transitioning the
 *       session to `awaiting_payment`. The downstream redirect handler
 *       at `/api/checkout/[sessionId]/redirect` polls for this field
 *       and forwards to Clover.
 * Deny: marks the session `cancelled`. Stock release is handled by the
 *       reconciler cron (#369).
 */
import {
  markAgeVerified,
  markCheckoutSessionCancelled,
} from '@/lib/repositories';

const SIMULATE_VERIFICATION_ID = 'simulate-preview';

function assertPreviewEnv(): void {
  if (process.env.VERCEL_ENV !== 'preview') {
    throw new Error('Simulate actions only allowed in preview env');
  }
}

export interface SimulateActionResult {
  ok: true;
}

export async function simulateAgeVerifyPass(
  sessionId: string
): Promise<SimulateActionResult> {
  assertPreviewEnv();
  await markAgeVerified(sessionId, SIMULATE_VERIFICATION_ID, new Date());
  return { ok: true };
}

export async function simulateAgeVerifyDeny(
  sessionId: string
): Promise<SimulateActionResult> {
  assertPreviewEnv();
  await markCheckoutSessionCancelled(sessionId);
  return { ok: true };
}
