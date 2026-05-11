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
  /**
   * Server-created AgeChecker session UUID (from `POST /v1/session/create`).
   * Required for the popup to associate its verification with the
   * server-supplied `callback_url` + `metadata.order`. Without it,
   * AgeChecker will not POST a webhook to our handler.
   */
  session?: string;
}

declare global {
  interface Window {
    AgeCheckerConfig?: AgeCheckerConfig;
  }
}
