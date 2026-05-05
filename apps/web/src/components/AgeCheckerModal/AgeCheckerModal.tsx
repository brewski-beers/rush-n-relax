'use client';

/**
 * AgeChecker.net widget wrapper.
 *
 * Two render paths:
 *  - **Test mode** (`NEXT_PUBLIC_AGECHECKER_TEST_MODE=true`): renders an inline
 *    simulate-modal with Pass/Deny buttons. Returns a synthetic
 *    `verificationId` via `onComplete` so the caller can drive the existing
 *    "create order in id_verified" path without any AgeChecker network calls.
 *  - **Live mode**: renders a real "Verify Age" button bound to the AgeChecker
 *    popup. Sets `window.AgeCheckerConfig` BEFORE loading
 *    `https://cdn.agechecker.net/static/popup/v1/popup.js`. The popup hijacks
 *    the bound button click — there is **no JS callback**. Verification flows
 *    server-side via `/api/webhooks/agechecker/route.ts`, which moves the
 *    order to `id_verified` (or `id_rejected`). The order page polls for the
 *    transition.
 *
 * Live-mode docs: https://agechecker.net/account/install/custom/client
 *
 * Test-mode strategy lives in `.env.example`.
 */
import Script from 'next/script';
import { useEffect } from 'react';
import './AgeCheckerModal.css';

export type AgeCheckOutcome =
  | { status: 'pass'; verificationId: string }
  | { status: 'deny'; reason: string };

/** Props for the **test-mode** simulate modal. */
interface TestModeProps {
  open: boolean;
  onComplete: (result: AgeCheckOutcome) => void;
  onClose: () => void;
}

/** Props for the **live** AgeChecker-bound button. */
interface LiveProps {
  /** Stable selector target — id of the button element. Must match the
   *  rendered button id and the `element` field of `AgeCheckerConfig`. */
  buttonId?: string;
  /** Order id passed through to AgeChecker so their webhook can correlate
   *  the verification result back to our order. */
  orderId: string;
  /** Customer email (optional but recommended — AC dedupes verifications). */
  customerEmail?: string;
  /** Visible button label. */
  label?: string;
  /** Optional class for the button. */
  className?: string;
}

declare global {
  interface Window {
    /** AgeChecker popup configuration. Must be set BEFORE popup.js loads. */
    AgeCheckerConfig?: {
      element: string;
      key: string;
      order?: string;
      email?: string;
    };
  }
}

const TEST_MODE = process.env.NEXT_PUBLIC_AGECHECKER_TEST_MODE === 'true';
const API_KEY = process.env.NEXT_PUBLIC_AGECHECKER_API_KEY ?? '';
const POPUP_SRC = 'https://cdn.agechecker.net/static/popup/v1/popup.js';
const DEFAULT_BUTTON_ID = 'agechecker-verify-button';

export function isAgeCheckerTestMode(): boolean {
  return TEST_MODE;
}

/* -------------------------------------------------------------------------- */
/* Test-mode simulate modal                                                    */
/* -------------------------------------------------------------------------- */

export function AgeCheckerModal({ open, onComplete, onClose }: TestModeProps) {
  if (!open) return null;
  if (!TEST_MODE) {
    // Live mode does not use a callback-driven modal. Callers should render
    // <AgeCheckerLiveButton> instead. We fail loudly in dev to catch wiring
    // mistakes early.
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        '[AgeCheckerModal] Rendered in live mode — use <AgeCheckerLiveButton> instead.'
      );
    }
    return null;
  }
  return (
    <div
      className="agechecker-test-overlay"
      role="dialog"
      aria-label="ID verification (test mode)"
    >
      <div className="agechecker-test-modal">
        <h2>ID Verification (Test Mode)</h2>
        <p>Preview environment — pick an outcome to simulate.</p>
        <div className="agechecker-test-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              onComplete({
                status: 'pass',
                verificationId: `test-verify-${Date.now()}`,
              })
            }
          >
            Simulate Pass
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              onComplete({ status: 'deny', reason: 'Simulated denial' })
            }
          >
            Simulate Deny
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Live AgeChecker button                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Renders the live AgeChecker-bound button. The popup script is loaded with
 * Next.js `<Script strategy="afterInteractive">`; `AgeCheckerConfig` is set
 * synchronously before the script tag so it is available when popup.js runs.
 *
 * There is no completion callback — verification result arrives server-side
 * at `/api/webhooks/agechecker`. The caller is responsible for polling the
 * order status (see `OrderStatusPoller`).
 */
export function AgeCheckerLiveButton({
  buttonId = DEFAULT_BUTTON_ID,
  orderId,
  customerEmail,
  label = 'Verify Age',
  className = 'btn btn-primary',
}: LiveProps) {
  // Set window.AgeCheckerConfig as early as possible — before the popup script
  // executes. We use a layout effect-style synchronous mount so the config
  // is in place by the time <Script afterInteractive> fires.
  useEffect(() => {
    window.AgeCheckerConfig = {
      element: `#${buttonId}`,
      key: API_KEY,
      order: orderId,
      ...(customerEmail ? { email: customerEmail } : {}),
    };
  }, [buttonId, orderId, customerEmail]);

  return (
    <>
      <button id={buttonId} type="button" className={className}>
        {label}
      </button>
      <Script
        id="agechecker-popup"
        src={POPUP_SRC}
        strategy="afterInteractive"
        crossOrigin=""
      />
    </>
  );
}
