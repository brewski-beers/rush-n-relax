'use client';

import './AgeGate.css';

interface Props {
  onVerified: () => void;
}

const COOKIE = 'ageVerified=true; max-age=31536000; path=/; SameSite=Strict';

/**
 * Entry-gate age affirmation. A single "Yes, I'm 21+" CTA persists a cookie
 * and calls `onVerified`; "No, exit" redirects away. Actual ID verification
 * happens at checkout via AgeChecker.net — this gate is friction-only.
 */
export function AgeGate({ onVerified }: Props) {
  const handleAffirm = () => {
    document.cookie = COOKIE;
    onVerified();
  };

  const handleDeny = () => {
    // Redirect away from the site for visitors who are not 21+
    window.location.href = 'https://www.google.com';
  };

  return (
    <div className="age-gate-overlay">
      <div className="age-gate-content">
        <div className="age-gate-header">
          <h1>Age Verification</h1>
          <p>You must be 21 or older to enter</p>
        </div>

        <div className="age-gate-actions">
          <button
            type="button"
            className="btn btn-primary age-gate-button"
            onClick={handleAffirm}
          >
            Yes, I&apos;m 21 or older
          </button>
          <button
            type="button"
            className="btn btn-secondary age-gate-button age-gate-button-secondary"
            onClick={handleDeny}
          >
            No, exit
          </button>
        </div>

        <p className="age-gate-disclaimer">
          By entering, you certify that you are of legal age to purchase
          cannabis in your jurisdiction.
        </p>
      </div>
    </div>
  );
}
