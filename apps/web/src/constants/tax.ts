/**
 * Sales-tax constants.
 *
 * KNOWN LIMITATION — flat-rate approximation. Tennessee charges a 7% state
 * sales-tax base plus a local-option rate that varies by county/city
 * (commonly +2.25% to +2.75%), so the effective rate at a given delivery
 * address is anywhere from ~9.25% to ~9.75%. We charge a single flat
 * `TN_SALES_TAX_RATE` until we wire either a ZIP/county rate table or a tax
 * API (e.g. TaxJar / Avalara). Until then, totals computed with this rate
 * are an estimate and may under- or over-collect by up to ~0.5pp.
 *
 * This is the SINGLE SOURCE OF TRUTH for the rate — server-side total
 * computation (`/api/checkout/session`) and the storefront cart estimate
 * both import it. Never re-declare the literal anywhere else.
 */
export const TN_SALES_TAX_RATE = 0.0925;
