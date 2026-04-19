'use client';

/**
 * AgeChecker.Net widget wrapper.
 *
 * Test-mode (preview/dev): bypasses the real widget and returns a deterministic
 * pass result. Flip NEXT_PUBLIC_AGECHECKER_TEST_MODE=false in production to load
 * the real widget.
 *
 * Integration note: AgeChecker's public widget shape is loaded via their hosted
 * script. The onComplete callback receives { status, verificationId }.
 */
import { useEffect, useRef, useState } from 'react';

export type AgeCheckOutcome =
  | { status: 'pass'; verificationId: string }
  | { status: 'deny'; reason: string };

interface Props {
  open: boolean;
  onComplete: (result: AgeCheckOutcome) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    AgeChecker?: {
      verify: (opts: {
        apiKey: string;
        onComplete: (r: {
          status: string;
          verificationId?: string;
          reason?: string;
        }) => void;
        onClose: () => void;
      }) => void;
    };
  }
}

const TEST_MODE = process.env.NEXT_PUBLIC_AGECHECKER_TEST_MODE === 'true';
const API_KEY = process.env.NEXT_PUBLIC_AGECHECKER_API_KEY ?? '';

export function AgeCheckerModal({ open, onComplete, onClose }: Props) {
  const scriptLoaded = useRef(false);
  const [testOutcome, setTestOutcome] = useState<'pass' | 'deny' | null>(null);

  useEffect(() => {
    if (!open || TEST_MODE) return;
    if (scriptLoaded.current) {
      invokeWidget();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.agechecker.net/widget.js';
    script.async = true;
    script.onload = () => {
      scriptLoaded.current = true;
      invokeWidget();
    };
    document.body.appendChild(script);

    function invokeWidget() {
      window.AgeChecker?.verify({
        apiKey: API_KEY,
        onComplete: r => {
          if (r.status === 'pass' && r.verificationId) {
            onComplete({ status: 'pass', verificationId: r.verificationId });
          } else {
            onComplete({
              status: 'deny',
              reason: r.reason ?? 'Verification failed',
            });
          }
        },
        onClose,
      });
    }
  }, [open, onComplete, onClose]);

  if (!open) return null;

  if (TEST_MODE) {
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
              onClick={() => {
                setTestOutcome('pass');
                onComplete({
                  status: 'pass',
                  verificationId: `test-verify-${Date.now()}`,
                });
              }}
            >
              Simulate Pass
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setTestOutcome('deny');
                onComplete({ status: 'deny', reason: 'Simulated denial' });
              }}
            >
              Simulate Deny
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
          {testOutcome && (
            <p className="agechecker-test-result">Outcome: {testOutcome}</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
