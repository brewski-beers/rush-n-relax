import { describe, it, expect } from 'vitest';
import { formatOrderStatus } from './formatOrderStatus';
import type { OrderStatus } from '@/types';

describe('formatOrderStatus', () => {
  const cases: Array<[OrderStatus, string]> = [
    ['paid', 'Paid'],
    ['preparing', 'Preparing'],
    ['out_for_delivery', 'Out for delivery'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
    ['refunded', 'Refunded'],
  ];

  it.each(cases)('formats %s as "%s"', (status, expected) => {
    expect(formatOrderStatus(status)).toBe(expected);
  });

  it('never returns the raw underscore enum value', () => {
    expect(formatOrderStatus('out_for_delivery')).not.toContain('_');
  });
});
