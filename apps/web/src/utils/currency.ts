/**
 * Format a price in cents as a US dollar string.
 * e.g. 1000 → "$10.00"
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
