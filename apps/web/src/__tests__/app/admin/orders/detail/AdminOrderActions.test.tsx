import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const { transitionOrderActionMock, refundOrderActionMock, routerRefreshMock } =
  vi.hoisted(() => ({
    transitionOrderActionMock: vi.fn(),
    refundOrderActionMock: vi.fn(),
    routerRefreshMock: vi.fn(),
  }));

vi.mock('@/app/(admin)/admin/orders/[id]/actions', () => ({
  transitionOrderAction: transitionOrderActionMock,
  refundOrderAction: refundOrderActionMock,
  resendOrderEmailAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

import { AdminOrderActions } from '@/app/(admin)/admin/orders/[id]/AdminOrderActions';
import type { OrderStatus } from '@/types';

function order(
  status: OrderStatus,
  opts: Partial<{ cloverPaymentId: string; total: number }> = {}
) {
  return {
    id: 'ord_1',
    status,
    cloverPaymentId: opts.cloverPaymentId ?? 'pay_1',
    total: opts.total ?? 5000,
  };
}

describe('AdminOrderActions — only renders allowed transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transitionOrderActionMock.mockResolvedValue({ ok: true });
    refundOrderActionMock.mockResolvedValue({ ok: true });
  });

  it('paid → shows preparing, refunded, cancelled (per ALLOWED_TRANSITIONS)', () => {
    render(<AdminOrderActions order={order('paid')} />);
    expect(screen.getByTestId('transition-btn-preparing')).toBeInTheDocument();
    expect(screen.getByTestId('transition-btn-refunded')).toBeInTheDocument();
    expect(screen.getByTestId('transition-btn-cancelled')).toBeInTheDocument();
    expect(screen.queryByTestId('transition-btn-paid')).toBeNull();
    expect(screen.queryByTestId('transition-btn-completed')).toBeNull();
  });

  it('completed → only refunded is allowed', () => {
    render(<AdminOrderActions order={order('completed')} />);
    expect(screen.getByTestId('transition-btn-refunded')).toBeInTheDocument();
    expect(screen.queryByTestId('transition-btn-cancelled')).toBeNull();
  });

  it('cancelled (terminal) → renders no transition buttons', () => {
    render(<AdminOrderActions order={order('cancelled')} />);
    expect(screen.queryByTestId('transition-btn-cancelled')).toBeNull();
    expect(screen.queryByTestId('refund-btn')).toBeNull();
  });

  it('shows the refund button only when status is paid', () => {
    const { rerender } = render(<AdminOrderActions order={order('paid')} />);
    expect(screen.getByTestId('refund-btn')).toBeInTheDocument();
    rerender(<AdminOrderActions order={order('preparing')} />);
    expect(screen.queryByTestId('refund-btn')).toBeNull();
  });
});

describe('AdminOrderActions — accessible confirmation dialog (#440)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transitionOrderActionMock.mockResolvedValue({ ok: true });
    refundOrderActionMock.mockResolvedValue({ ok: true });
  });

  it('destructive transition opens an alertdialog instead of window.confirm', () => {
    render(<AdminOrderActions order={order('paid')} />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByTestId('transition-btn-cancelled'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(transitionOrderActionMock).not.toHaveBeenCalled();
  });

  it('cancelling the dialog skips the action', () => {
    render(<AdminOrderActions order={order('paid')} />);
    fireEvent.click(screen.getByTestId('transition-btn-cancelled'));
    fireEvent.click(screen.getByTestId('admin-confirm-cancel'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(transitionOrderActionMock).not.toHaveBeenCalled();
  });

  it('confirming the dialog runs the transition', () => {
    render(<AdminOrderActions order={order('paid')} />);
    fireEvent.click(screen.getByTestId('transition-btn-cancelled'));
    fireEvent.click(screen.getByTestId('admin-confirm-ok'));
    expect(transitionOrderActionMock).toHaveBeenCalledWith('ord_1', 'cancelled');
  });

  it('non-destructive transitions (preparing) skip the dialog', () => {
    render(<AdminOrderActions order={order('paid')} />);
    fireEvent.click(screen.getByTestId('transition-btn-preparing'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(transitionOrderActionMock).toHaveBeenCalledWith('ord_1', 'preparing');
  });

  it('refund button opens a dialog containing the payment id and amount', () => {
    render(
      <AdminOrderActions
        order={order('paid', { cloverPaymentId: 'pay_X', total: 1234 })}
      />
    );
    fireEvent.click(screen.getByTestId('refund-btn'));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('pay_X');
    expect(dialog.textContent).toContain('$12.34');
    expect(refundOrderActionMock).not.toHaveBeenCalled();
  });

  it('ESC key closes the dialog without running the action', () => {
    render(<AdminOrderActions order={order('paid')} />);
    fireEvent.click(screen.getByTestId('transition-btn-cancelled'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(transitionOrderActionMock).not.toHaveBeenCalled();
  });
});
