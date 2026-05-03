import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CartContext } from '@/contexts/CartContext';
import type { CartContextValue, CartItem } from '@/contexts/CartContext';

// Mock AgeCheckerModal — we test that CartPage wires it correctly
// (open prop, onComplete callback), not the modal's internal widget logic.
// The modal has its own dedicated tests.
vi.mock('@/components/AgeCheckerModal/AgeCheckerModal', () => ({
  AgeCheckerModal: ({
    open,
    onComplete,
    onClose,
  }: {
    open: boolean;
    onComplete: (r: { status: 'pass'; verificationId: string }) => void;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="agechecker-modal">
        <button
          type="button"
          onClick={() =>
            onComplete({ status: 'pass', verificationId: 'verif-stub-1' })
          }
        >
          Simulate Pass
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import CartPage from './CartPage';

const SAMPLE_ITEM: CartItem = {
  productId: 'p1',
  variantId: 'v1',
  variantLabel: '1g',
  name: 'Sample Bud',
  unitPrice: 1500,
  quantity: 1,
};

function makeCartCtx(
  overrides: Partial<CartContextValue> = {}
): CartContextValue {
  return {
    items: [SAMPLE_ITEM],
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQty: vi.fn(),
    clearCart: vi.fn(),
    totalItems: 1,
    subtotal: 1500,
    ...overrides,
  };
}

function renderCart(ctx: CartContextValue = makeCartCtx()) {
  return render(
    <CartContext.Provider value={ctx}>
      <CartPage />
    </CartContext.Provider>
  );
}

function fillForm(state = 'TN') {
  fireEvent.change(screen.getByLabelText(/Full name/i), {
    target: { value: 'KB Test' },
  });
  fireEvent.change(screen.getByLabelText(/Street address/i), {
    target: { value: '1 Main St' },
  });
  fireEvent.change(screen.getByLabelText(/^City$/i), {
    target: { value: 'Knoxville' },
  });
  fireEvent.change(screen.getByLabelText(/^State$/i), {
    target: { value: state },
  });
  fireEvent.change(screen.getByLabelText(/^ZIP$/i), {
    target: { value: '37902' },
  });
  fireEvent.change(screen.getByLabelText(/Email/i), {
    target: { value: 'kb@example.com' },
  });
}

describe('CartPage — AgeCheckerModal wiring', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('disables Verify Age button until form valid + state shippable', () => {
    renderCart();
    const btn = screen.getByRole('button', { name: /verify age/i });
    expect(btn).toBeDisabled();
  });

  it('keeps Verify Age disabled when state is non-shippable', () => {
    renderCart();
    fillForm('ID');
    const btn = screen.getByRole('button', { name: /verify age/i });
    expect(btn).toBeDisabled();
  });

  it('opens AgeCheckerModal on Verify Age click when form valid + state shippable', () => {
    renderCart();
    fillForm('TN');
    const btn = screen.getByRole('button', { name: /verify age/i });
    expect(btn).not.toBeDisabled();
    expect(screen.queryByTestId('agechecker-modal')).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByTestId('agechecker-modal')).toBeInTheDocument();
  });

  it('on pass outcome, POSTs verificationId to /api/order/start and redirects to /order/[id]', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ orderId: 'order-xyz' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const assignMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignMock },
    });

    renderCart();
    fillForm('TN');
    fireEvent.click(screen.getByRole('button', { name: /verify age/i }));
    fireEvent.click(screen.getByRole('button', { name: /simulate pass/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/order/start',
        expect.objectContaining({ method: 'POST' })
      );
    });
    const callBody = JSON.parse(
      // Justified cast: mock arg shape known.
      (fetchMock.mock.calls[0][1] as { body: string }).body
    ) as { verificationId: string; deliveryAddress: { state: string } };
    expect(callBody.verificationId).toBe('verif-stub-1');
    expect(callBody.deliveryAddress.state).toBe('TN');

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('/order/order-xyz');
    });
  });
});
