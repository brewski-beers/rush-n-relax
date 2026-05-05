/**
 * Shared shape for the AgeChecker.Net popup config object.
 *
 * The popup script reads `window.AgeCheckerConfig` on load. This module is
 * the single source of truth for that global shape so the verify page
 * client and the `AgeCheckerGuard` component can't drift into conflicting
 * `declare global` blocks.
 */
export interface AgeCheckerConfig {
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
