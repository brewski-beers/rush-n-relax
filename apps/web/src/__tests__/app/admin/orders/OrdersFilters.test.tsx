import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

import { OrdersFilters } from '@/app/(admin)/admin/orders/OrdersFilters';

const LOCATIONS = [
  { id: 'oak-ridge', name: 'Oak Ridge' },
  { id: 'maryville', name: 'Maryville' },
];

describe('OrdersFilters', () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  describe('given the user enters filters and submits', () => {
    it('pushes a URL with all non-empty filter params', () => {
      render(<OrdersFilters locations={LOCATIONS} initial={{}} />);

      fireEvent.change(screen.getByLabelText(/status/i), {
        target: { value: 'paid' },
      });
      fireEvent.change(screen.getByLabelText(/location/i), {
        target: { value: 'oak-ridge' },
      });
      fireEvent.change(screen.getByLabelText(/from/i), {
        target: { value: '2026-01-01' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'jane@example.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(pushMock).toHaveBeenCalledTimes(1);
      const url = pushMock.mock.calls[0][0] as string;
      expect(url).toContain('/admin/orders?');
      expect(url).toContain('status=paid');
      expect(url).toContain('locationId=oak-ridge');
      expect(url).toContain('from=2026-01-01');
      expect(url).toContain('q=jane%40example.com');
    });
  });

  describe('given the user submits with no filter values', () => {
    it('pushes the bare /admin/orders URL', () => {
      render(<OrdersFilters locations={LOCATIONS} initial={{}} />);
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
      expect(pushMock).toHaveBeenCalledWith('/admin/orders');
    });
  });

  describe('given the user clicks reset', () => {
    it('clears all fields and navigates to bare /admin/orders', () => {
      render(
        <OrdersFilters
          locations={LOCATIONS}
          initial={{ status: 'paid', q: 'jane@example.com' }}
        />
      );

      expect(screen.getByLabelText(/status/i)).toHaveValue('paid');
      fireEvent.click(screen.getByRole('button', { name: /reset/i }));

      expect(pushMock).toHaveBeenCalledWith('/admin/orders');
      expect(screen.getByLabelText(/status/i)).toHaveValue('');
      expect(screen.getByLabelText(/email/i)).toHaveValue('');
    });
  });

  describe('given initial filter values', () => {
    it('prefills the inputs from props', () => {
      render(
        <OrdersFilters
          locations={LOCATIONS}
          initial={{
            status: 'preparing',
            locationId: 'maryville',
            from: '2026-02-01',
            to: '2026-02-28',
            q: 'kb@example.com',
          }}
        />
      );

      expect(screen.getByLabelText(/status/i)).toHaveValue('preparing');
      expect(screen.getByLabelText(/location/i)).toHaveValue('maryville');
      expect(screen.getByLabelText(/from/i)).toHaveValue('2026-02-01');
      expect(screen.getByLabelText(/^to$/i)).toHaveValue('2026-02-28');
      expect(screen.getByLabelText(/email/i)).toHaveValue('kb@example.com');
    });
  });
});
