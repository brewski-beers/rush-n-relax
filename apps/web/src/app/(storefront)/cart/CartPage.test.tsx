import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CartContext } from '@/contexts/CartContext';
import type { CartContextValue, CartItem } from '@/contexts/CartContext';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
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

describe('CartPage — single-button checkout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
  });

  describe('validation gates', () => {
    it('Given an empty form, When the cart loads, Then the Checkout button is disabled', () => {
      renderCart();
      const btn = screen.getByRole('button', { name: /checkout/i });
      expect(btn).toBeDisabled();
    });

    it('Given a form filled with a non-shippable state, When validated, Then the Checkout button stays disabled', () => {
      renderCart();
      fillForm('ID');
      const btn = screen.getByRole('button', { name: /checkout/i });
      expect(btn).toBeDisabled();
    });

    it('Given a complete shippable form, When validated, Then the Checkout button is enabled', () => {
      renderCart();
      fillForm('TN');
      const btn = screen.getByRole('button', { name: /checkout/i });
      expect(btn).not.toBeDisabled();
    });
  });

  describe('redirect on success', () => {
    it('Given a valid cart, When Checkout is clicked, Then it POSTs to /api/checkout/session and pushes the redirectUrl', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'sess-123',
            redirectUrl: '/checkout/sess-123/verify',
          }),
      });
      vi.stubGlobal('fetch', fetchMock);

      renderCart();
      fillForm('TN');
      fireEvent.click(screen.getByRole('button', { name: /checkout/i }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/checkout/session',
          expect.objectContaining({ method: 'POST' })
        );
      });

      const callBody = JSON.parse(
        // Justified cast: mock arg shape known.
        (fetchMock.mock.calls[0][1] as { body: string }).body
      ) as {
        deliveryAddress: { state: string };
        locationId: string;
        customerEmail?: string;
      };
      expect(callBody.deliveryAddress.state).toBe('TN');
      expect(callBody.locationId).toBe('online');
      expect(callBody.customerEmail).toBe('kb@example.com');

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/checkout/sess-123/verify');
      });
    });

    it('does not render any AgeChecker modal element', () => {
      renderCart();
      fillForm('TN');
      expect(screen.queryByTestId('agechecker-modal')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /verify age/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('Given a 409 shortage response, When Checkout is clicked, Then the inline error from the server is shown and no redirect occurs', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            error: 'Insufficient stock',
            productId: 'p1',
            variantId: 'v1',
            available: 0,
            requested: 1,
          }),
      });
      vi.stubGlobal('fetch', fetchMock);

      renderCart();
      fillForm('TN');
      fireEvent.click(screen.getByRole('button', { name: /checkout/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /insufficient stock/i
        );
      });
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('Given a generic Clover failure (500 with no redirectUrl), When Checkout is clicked, Then a fallback error is shown', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Clover unavailable' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      renderCart();
      fillForm('TN');
      fireEvent.click(screen.getByRole('button', { name: /checkout/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /clover unavailable/i
        );
      });
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('Given a network error (fetch rejects), When Checkout is clicked, Then a network error is shown', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
      vi.stubGlobal('fetch', fetchMock);

      renderCart();
      fillForm('TN');
      fireEvent.click(screen.getByRole('button', { name: /checkout/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
      });
      expect(pushMock).not.toHaveBeenCalled();
    });
  });
});
