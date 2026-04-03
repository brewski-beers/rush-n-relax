/**
 * Pricing utilities for product cost/markup calculations.
 */

/**
 * Compute markup percentage from cost and price (both in cents).
 * Returns undefined if cost is 0 or not provided (division by zero guard).
 */
export function computeMarkupPercent(
  cost: number | undefined,
  price: number
): number | undefined {
  if (cost === undefined || cost === 0) return undefined;
  return ((price - cost) / cost) * 100;
}

/**
 * Format a cent value as a USD currency string, e.g. "$12.99".
 * Returns an empty string for undefined/null values.
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
