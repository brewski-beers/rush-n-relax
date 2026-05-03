import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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
    // Should NOT show terminal-only or earlier states
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

describe('AdminOrderActions — confirmation gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transitionOrderActionMock.mockResolvedValue({ ok: true });
    refundOrderActionMock.mockResolvedValue({ ok: true });
  });

  it('cancel transition requires window.confirm; cancelling the dialog skips the action', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminOrderActions order={order('paid')} />);
    fireEvent.click(screen.getByTestId('transition-btn-cancelled'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(transitionOrderActionMock).not.toHaveBeenCalled();
  });

  it('non-destructive transitions (preparing) skip the confirm dialog', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<AdminOrderActions order={order('paid')} />);
    fireEvent.click(screen.getByTestId('transition-btn-preparing'));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('refund button always shows a confirm dialog with payment id + amount', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <AdminOrderActions
        order={order('paid', { cloverPaymentId: 'pay_X', total: 1234 })}
      />
    );
    fireEvent.click(screen.getByTestId('refund-btn'));
    expect(confirmSpy).toHaveBeenCalledOnce();
    const message = confirmSpy.mock.calls[0][0] as string;
    expect(message).toContain('pay_X');
    expect(message).toContain('$12.34');
    expect(refundOrderActionMock).not.toHaveBeenCalled();
  });
});
