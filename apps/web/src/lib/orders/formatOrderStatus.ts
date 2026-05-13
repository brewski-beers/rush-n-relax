import type { OrderStatus } from '@/types';

/**
 * Convert raw OrderStatus enum to a human-friendly label.
 *
 * Used in admin status badges, filter dropdowns, and transition button
 * labels. Keeps raw enum values out of the rendered UI.
 */
export function formatOrderStatus(status: OrderStatus): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'preparing':
      return 'Preparing';
    case 'out_for_delivery':
      return 'Out for delivery';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'refunded':
      return 'Refunded';
  }
}
