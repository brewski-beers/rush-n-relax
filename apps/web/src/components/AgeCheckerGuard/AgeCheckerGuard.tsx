'use client';

/**
 * AgeCheckerGuard — wires the AgeChecker.Net Client API popup to the
 * "proceed to payment" button on the verify page.
 *
 * The popup script reads `window.AgeCheckerConfig` on load. We set the
 * config object in a layout effect so it lands on `window` before the
 * `afterInteractive` script tag boots (next/script defers script execution
 * until after hydration). The script attaches itself to the configured
 * `element` selector — no imperative `window.AgeChecker.verify()` calls.
 *
 * Verification outcome is delivered server-side via the AgeChecker webhook
 * (see apps/web/src/app/api/webhooks/agechecker), which marks
 * `CheckoutSession.ageVerifiedAt` keyed by `order` (the session id).
 */
import { useLayoutEffect } from 'react';
import Script from 'next/script';
import '@/types/agechecker-window';

interface Props {
  sessionId: string;
  customerEmail: string;
}

const POPUP_SRC = 'https://cdn.agechecker.net/static/popup/v1/popup.js';

export function AgeCheckerGuard({ sessionId, customerEmail }: Props) {
  useLayoutEffect(() => {
    window.AgeCheckerConfig = {
      element: '#proceed-to-payment',
      key: process.env.NEXT_PUBLIC_AGECHECKER_API_KEY ?? '',
      order: sessionId,
      email: customerEmail,
    };
  }, [sessionId, customerEmail]);

  return <Script src={POPUP_SRC} strategy="afterInteractive" />;
}
