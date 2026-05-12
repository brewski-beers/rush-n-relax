/**
 * Shared shape for the AgeChecker.Net popup config object.
 *
 * The popup script reads `window.AgeCheckerConfig` on load. This module is
 * the single source of truth for that global shape so the verify page
 * client and the `AgeCheckerGuard` component can't drift into conflicting
 * `declare global` blocks.
 */
/**
 * A verification object as handed to the popup lifecycle hooks. The popup
 * gives us the *verification* uuid (not the session uuid) in `oncreated`
 * and `onstatuschanged`.
 */
export interface AgeCheckerVerification {
  uuid: string;
}

/** Documented AgeChecker popup verification statuses. */
export type AgeCheckerPopupStatus =
  | 'accepted'
  | 'denied'
  | 'signature'
  | 'photo_id'
  | 'phone_validation'
  | 'sms_sent'
  | 'pending';

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
  /**
   * When true, the popup defers the final form submit until `done()` is
   * invoked from `onclosed` — lets us land a server confirm-POST before
   * the page navigates.
   */
  defer_submit?: boolean;
  /** Fired when the initial verification request is submitted; carries the verification uuid. */
  oncreated?: (
    verification: AgeCheckerVerification,
    cancel: () => void
  ) => void;
  /**
   * Fired whenever a status is received for the verification. `status` is
   * one of the {@link AgeCheckerPopupStatus} values in practice, but typed
   * as `string` so an unrecognised value from AgeChecker doesn't break the
   * build (compare against the documented literals at the call site).
   */
  onstatuschanged?: (
    verification: AgeCheckerVerification & { status: string }
  ) => void;
  /** Fired when the popup is closed after an accepted verification. Must call `done()` if `defer_submit` is set. */
  onclosed?: (done: () => void) => void;
}

declare global {
  interface Window {
    AgeCheckerConfig?: AgeCheckerConfig;
  }
}
