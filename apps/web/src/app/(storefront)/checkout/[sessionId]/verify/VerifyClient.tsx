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
 */
import Script from 'next/script';
import { useEffect } from 'react';

interface Props {
  sessionId: string;
  apiKey: string;
  customerEmail: string | undefined;
  redirectUrl: string;
}

interface AgeCheckerConfig {
  element: string;
  key: string;
  order: string;
  email?: string;
}

declare global {
  interface Window {
    AgeCheckerConfig?: AgeCheckerConfig;
  }
}

const POPUP_SRC = 'https://cdn.agechecker.net/static/popup/v1/popup.js';

export function VerifyClient({
  sessionId,
  apiKey,
  customerEmail,
  redirectUrl,
}: Props) {
  // Assign AgeCheckerConfig synchronously on the client BEFORE the popup
  // script tag mounts. `useEffect` runs after the DOM is committed but
  // before next/script's `afterInteractive` strategy injects the tag,
  // satisfying the config-then-load contract.
  useEffect(() => {
    const config: AgeCheckerConfig = {
      element: '#proceed-to-payment',
      key: apiKey,
      order: sessionId,
      ...(customerEmail ? { email: customerEmail } : {}),
    };
    window.AgeCheckerConfig = config;
  }, [apiKey, sessionId, customerEmail]);

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
    </>
  );
}
