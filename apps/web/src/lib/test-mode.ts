/**
 * Test-mode kill switch.
 *
 * `CLOVER_LIVE_PAYMENTS_ENABLED` is the single source of truth for "is this
 * real money". When unset or anything other than the exact string `'true'`,
 * the system runs in TEST MODE: the Clover bridge stubs out, every new order
 * is tagged `testMode: true`, and the storefront shows a banner.
 *
 * Default is FALSE — the kill switch is closed by default. Production must
 * explicitly flip the env var to enable real charges.
 */
export function isLivePaymentsEnabled(): boolean {
  return process.env.CLOVER_LIVE_PAYMENTS_ENABLED === 'true';
}
