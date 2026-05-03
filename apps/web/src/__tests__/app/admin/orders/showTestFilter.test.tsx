import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

import { OrdersFilters } from '@/app/(admin)/admin/orders/OrdersFilters';

const LOCATIONS = [{ id: 'oak-ridge', name: 'Oak Ridge' }];

describe('OrdersFilters — showTest checkbox', () => {
  beforeEach(() => pushMock.mockClear());

  it('does not include showTest in the URL by default (test orders hidden)', () => {
    render(<OrdersFilters locations={LOCATIONS} initial={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    const url = pushMock.mock.calls[0][0] as string;
    expect(url).not.toContain('showTest');
  });

  it('appends showTest=true when the checkbox is enabled', () => {
    render(<OrdersFilters locations={LOCATIONS} initial={{}} />);
    fireEvent.click(screen.getByLabelText(/test orders/i));
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    const url = pushMock.mock.calls[0][0] as string;
    expect(url).toContain('showTest=true');
  });

  it('hydrates initial.showTest=true into the checkbox', () => {
    render(
      <OrdersFilters locations={LOCATIONS} initial={{ showTest: 'true' }} />
    );
    const cb = screen.getByLabelText(/test orders/i);
    expect((cb as HTMLInputElement).checked).toBe(true);
  });
});
