import { isLivePaymentsEnabled } from '@/lib/test-mode';

/**
 * Sticky storefront banner shown when the live-payments kill switch is OFF.
 * Hidden when live payments are enabled. Mounted in the storefront layout
 * only — the admin shell has its own layout and stays banner-free per spec.
 *
 * Visual styling lives in `src/styles/test-mode.css` (`.test-mode-banner`).
 */
export function TestModeBanner() {
  if (isLivePaymentsEnabled()) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="test-mode-banner"
      className="test-mode-banner"
    >
      🧪 TEST MODE — no real payments
    </div>
  );
}
