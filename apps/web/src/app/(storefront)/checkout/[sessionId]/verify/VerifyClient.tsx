'use client';

/**
 * Client-side AgeChecker popup binding for /checkout/[sessionId]/verify
 * (#365).
 *
 * AgeChecker's popup script intercepts the first click on the configured
 * element. To meet the popup contract:
 *
 *   1. `window.AgeCheckerConfig` MUST be assigned BEFORE the popup script
 *      is loaded (config-then-load ordering).
 *   2. The bound element must already exist in the DOM when the script
 *      finishes loading.
 *   3. Clicks on the bound element should fall through to a real
 *      navigation — the popup intercepts the first click and runs
 *      verification; it re-fires the click once verification passes.
 *
 * #370 will extract this into a reusable `AgeCheckerGuard` component.
 * Until then we inline the binding here so this PR is self-contained.
 *
 * Non-production simulate buttons (#411) render below the proceed CTA
 * when the server passes `showSimulator === true` (i.e. `VERCEL_ENV !==
 * 'production'`, covering Vercel preview deploys and local dev). Server
 * reads `VERCEL_ENV` directly so the panel is impossible to render on
 * prod, regardless of client-side env injection.
 */
import Script from 'next/script';
import { useCallback, useEffect, useRef, useTransition } from 'react';
import type { AgeCheckerConfig } from '@/types/agechecker-window';
import '@/types/agechecker-window';
import {
  simulateAgeVerifyPass,
  simulateAgeVerifyDeny,
} from './simulate-actions';
import previewStyles from './preview-tools.module.css';

interface Props {
  sessionId: string;
  apiKey: string;
  /**
   * Server-created AgeChecker session UUID — needed so the popup's
   * verification result is PUT to our webhook with metadata.order set.
   * `undefined` in the degraded path where `session/create` failed: the
   * popup still loads (so the page renders) but the callback won't fire.
   */
  ageCheckerSessionId: string | undefined;
  customerEmail: string | undefined;
  redirectUrl: string;
  showSimulator?: boolean;
}

const POPUP_SRC = 'https://cdn.agechecker.net/static/popup/v1/popup.js';

export function VerifyClient({
  sessionId,
  apiKey,
  ageCheckerSessionId,
  customerEmail,
  redirectUrl,
  showSimulator = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  // Guards a single confirm-POST per popup lifecycle — `onstatuschanged`
  // may fire `accepted` more than once; we only need to confirm once.
  const confirmedRef = useRef(false);

  // POST the verification uuid to our server, which does the authoritative
  // `GET /v1/status/{uuid}` lookup and applies the state transition. Small
  // retry-with-backoff because if this never lands the customer is stuck at
  // 408 on the redirect endpoint. `keepalive: true` so the request survives
  // the imminent navigation to `/api/checkout/<id>/redirect`.
  //
  // Robustness choice: rather than gating navigation on this POST (which
  // would need `defer_submit: true` + the `onclosed(done)` dance and a
  // hard timeout if `done()` is never reached), we fire it eagerly on the
  // `accepted` status and let the `/redirect` route's existing ~5s
  // Firestore poll observe `ageVerifiedAt` even if the POST lands slightly
  // late. Simpler, and the poll is the same backstop the webhook path uses.
  const confirmAge = useCallback(
    (verificationUuid: string): void => {
      if (confirmedRef.current) return;
      confirmedRef.current = true;
      void (async () => {
        const url = `/api/checkout/${encodeURIComponent(sessionId)}/confirm-age`;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ verificationUuid }),
              keepalive: true,
            });
            // 4xx other than 422 aren't retryable; 422/5xx/network → retry.
            if (
              res.ok ||
              (res.status >= 400 && res.status < 500 && res.status !== 422)
            ) {
              return;
            }
          } catch {
            // network error — fall through to retry
          }
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 250 * attempt));
          }
        }
      })();
    },
    [sessionId]
  );

  // Assign AgeCheckerConfig synchronously on the client BEFORE the popup
  // script tag mounts. `useEffect` runs after the DOM is committed but
  // before next/script's `afterInteractive` strategy injects the tag,
  // satisfying the config-then-load contract.
  useEffect(() => {
    const config: AgeCheckerConfig = {
      element: '#proceed-to-payment',
      key: apiKey,
      order: sessionId,
      ...(ageCheckerSessionId ? { session: ageCheckerSessionId } : {}),
      ...(customerEmail ? { email: customerEmail } : {}),
      // Trigger: the popup hands us the verification uuid + status here.
      // `accepted` → server marks age-verified; `denied` → server cancels +
      // releases holds (then the popup's own logic routes the customer to
      // /checkout/cancelled). Intermediate step-up statuses (signature /
      // photo_id / …) need no action — the server lookup would just say
      // `pending`. We deliberately do NOT also confirm on `oncreated`: at
      // create time the status is still unknown, so the lookup is wasted.
      onstatuschanged: verification => {
        if (
          verification.status === 'accepted' ||
          verification.status === 'denied'
        ) {
          confirmAge(verification.uuid);
        }
      },
    };
    window.AgeCheckerConfig = config;
  }, [apiKey, sessionId, ageCheckerSessionId, customerEmail, confirmAge]);

  const handleSimulatePass = () => {
    startTransition(async () => {
      await simulateAgeVerifyPass(sessionId);
      window.location.href = redirectUrl;
    });
  };

  const handleSimulateDeny = () => {
    startTransition(async () => {
      await simulateAgeVerifyDeny(sessionId);
      window.location.href = `/checkout/cancelled?session=${encodeURIComponent(sessionId)}`;
    });
  };

  return (
    <>
      <Script
        src={POPUP_SRC}
        strategy="afterInteractive"
        data-testid="agechecker-popup-script"
      />
      <a
        id="proceed-to-payment"
        href={redirectUrl}
        className="btn btn-primary"
        data-testid="proceed-to-payment"
      >
        Proceed to Payment
      </a>

      {showSimulator && (
        <div className={previewStyles.previewTools} data-testid="preview-tools">
          <p className={previewStyles.warning}>
            ⚠️ Non-production only — bypasses real verification
          </p>
          <button
            type="button"
            onClick={handleSimulatePass}
            disabled={isPending}
            className={`btn btn-secondary ${previewStyles.passButton}`}
            data-testid="simulate-pass"
          >
            Simulate Pass
          </button>
          <button
            type="button"
            onClick={handleSimulateDeny}
            disabled={isPending}
            className="btn btn-secondary"
            data-testid="simulate-deny"
          >
            Simulate Deny
          </button>
        </div>
      )}
    </>
  );
}
