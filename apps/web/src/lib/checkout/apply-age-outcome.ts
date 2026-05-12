/**
 * Shared "apply an AgeChecker verification outcome to a CheckoutSession"
 * logic.
 *
 * Two independent paths deliver an AgeChecker verification result to our
 * backend, and BOTH must produce the same state transition:
 *
 *   1. **Client-side (primary)** — the popup's `onstatuschanged` /
 *      `oncreated` hooks hand the browser the verification uuid; the verify
 *      page POSTs it to `/api/checkout/[sessionId]/confirm-age`.
 *   2. **Server callback (backstop)** — AgeChecker PUTs `{ uuid, status }`
 *      to `/api/webhooks/agechecker`. This only fires for popup-created
 *      verifications if AgeChecker support has enabled "automatic webhooks"
 *      on the account; otherwise it never arrives, which is exactly why
 *      path 1 exists.
 *
 * In both cases the claimed status from the wire is NOT trusted —
 * `verifyVerificationId(uuid)` (`GET /v1/status/{uuid}` with the account
 * secret) is the authoritative check. This module owns that lookup + the
 * resulting `markAgeVerified` / `markCheckoutSessionCancelled` +
 * `releaseStock` branching so the two callers can't drift.
 */
import { normalizeStatus, verifyVerificationId } from '@/lib/agechecker';
import {
  getCheckoutSession,
  markAgeVerified,
  markCheckoutSessionCancelled,
  InvalidCheckoutSessionTransitionError,
  releaseStock,
  type HoldRequest,
} from '@/lib/repositories';
import type { CheckoutSession } from '@/types/checkout-session';

/**
 * Outcome of applying a verification result to a session. The HTTP layer
 * maps these to status codes / bodies; this module is transport-agnostic.
 *
 *   - `verified`          — session moved `awaiting_id → awaiting_payment`.
 *   - `already_verified`  — session was already past `awaiting_id`
 *                           (idempotent re-delivery, or the other path won
 *                           the race). No state change.
 *   - `denied`            — AgeChecker denied; session cancelled + holds
 *                           released.
 *   - `already_cancelled` — session was already cancelled (idempotent).
 *   - `pending`           — non-terminal step-up (signature / photo_id /
 *                           phone_validation / sms_sent / pending). No
 *                           state change; the customer has more to do.
 *   - `session_not_found` — no CheckoutSession for the resolved id.
 *   - `session_terminal`  — session is `completed` / `expired` and cannot
 *                           accept a verification outcome.
 *   - `lookup_failed`     — `GET /v1/status/{uuid}` did not resolve to a
 *                           usable `accepted` / `denied` answer.
 */
export type ApplyAgeOutcomeResult =
  | { kind: 'verified'; sessionId: string }
  | { kind: 'already_verified'; sessionId: string }
  | { kind: 'denied'; sessionId: string }
  | { kind: 'already_cancelled'; sessionId: string }
  | { kind: 'pending'; sessionId: string | null }
  | { kind: 'session_not_found'; sessionId: string }
  | { kind: 'session_terminal'; sessionId: string; status: string }
  | { kind: 'lookup_failed' };

interface ApplyAgeOutcomeOptions {
  /**
   * AgeChecker verification (or session) uuid to look up. The popup hands
   * us the *verification* uuid in its hooks; the webhook body carries the
   * same id. `/v1/status/{uuid}` echoes `metadata.order` back either way.
   */
  verificationUuid: string;
  /**
   * Pre-resolved CheckoutSession id. The confirm-age route already has it
   * from the URL, so it can skip the `metadata.order` round-trip for
   * resolution (the lookup still runs for the authoritative status). The
   * webhook handler omits this and relies on `metadata.order`.
   */
  sessionId?: string;
  /** Label recorded in stock-release audit + logs (`webhook:agechecker`, `confirm-age`). */
  actor: string;
}

function toHoldRequests(session: CheckoutSession): HoldRequest[] {
  return (session.holds ?? []).map(h => ({
    productId: h.productId,
    variantId: h.variantId,
    locationId: h.locationId,
    qty: h.qty,
  }));
}

export async function applyAgeVerificationOutcome(
  opts: ApplyAgeOutcomeOptions
): Promise<ApplyAgeOutcomeResult> {
  const { verificationUuid, actor } = opts;

  const lookup = await verifyVerificationId(verificationUuid);

  // Authoritative status: `valid` is the only signal that means
  // "AgeChecker says accepted"; otherwise fold the lookup status.
  const status = lookup.valid ? 'pass' : normalizeStatus(lookup.status);

  // Resolve the CheckoutSession id: caller-supplied wins; fall back to the
  // `metadata.order` echoed by `/v1/status`.
  const resolvedSessionId =
    opts.sessionId ??
    (typeof lookup.metadata?.order === 'string'
      ? lookup.metadata.order
      : undefined);

  // Non-terminal step-up — nothing to do regardless of session resolution.
  if (status === 'pending' || status === 'manual_review') {
    return { kind: 'pending', sessionId: resolvedSessionId ?? null };
  }

  // Past this point we need a session id and a session.
  if (!resolvedSessionId) {
    // Lookup couldn't tell us which session this belongs to and the caller
    // didn't either — treat as a failed lookup so the caller can log/retry.
    return { kind: 'lookup_failed' };
  }

  const session = await getCheckoutSession(resolvedSessionId);
  if (!session) {
    return { kind: 'session_not_found', sessionId: resolvedSessionId };
  }

  if (session.status === 'completed' || session.status === 'expired') {
    return {
      kind: 'session_terminal',
      sessionId: resolvedSessionId,
      status: session.status,
    };
  }

  if (status === 'pass') {
    // Idempotent: already verified / promoted → ack.
    if (session.status !== 'awaiting_id' || session.ageVerifiedAt !== null) {
      return { kind: 'already_verified', sessionId: resolvedSessionId };
    }

    const verifiedAt = lookup.verifiedAt ?? new Date();
    try {
      await markAgeVerified(resolvedSessionId, verificationUuid, verifiedAt);
    } catch (err) {
      if (err instanceof InvalidCheckoutSessionTransitionError) {
        // Lost the race to the other path — treat as already-processed.
        return { kind: 'already_verified', sessionId: resolvedSessionId };
      }
      throw err;
    }
    return { kind: 'verified', sessionId: resolvedSessionId };
  }

  // Terminal denial: deny / underage.
  if (status === 'deny' || status === 'underage') {
    if (session.status === 'cancelled') {
      return { kind: 'already_cancelled', sessionId: resolvedSessionId };
    }

    try {
      await markCheckoutSessionCancelled(resolvedSessionId);
    } catch (err) {
      if (err instanceof InvalidCheckoutSessionTransitionError) {
        return { kind: 'already_cancelled', sessionId: resolvedSessionId };
      }
      throw err;
    }

    // Release the holds so storefront stock is honest. Non-fatal — the
    // cron sweep reconciles if this throws.
    const holds = toHoldRequests(session);
    if (holds.length > 0) {
      try {
        await releaseStock(holds, {
          source: 'order',
          actor,
          reason: `agechecker:${status}`,
        });
      } catch (err) {
        console.error('[agechecker] releaseStock failed', {
          sessionId: resolvedSessionId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { kind: 'denied', sessionId: resolvedSessionId };
  }

  // Should not reach — defensive.
  return { kind: 'lookup_failed' };
}
