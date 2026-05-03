import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { OrderStatusPoller } from '@/app/(storefront)/order/[id]/OrderStatusPoller';

vi.mock('@/hooks/useCart', () => ({
  useCart: () => ({ clearCart: vi.fn() }),
}));

describe('OrderStatusPoller', () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;
  let assignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    assignMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign: assignMock },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('mounts on id_verified, POSTs to /api/checkout/session, and redirects to Clover', async () => {
    const fetchImpl: typeof fetch = (input, init) => {
      // OrderStatusPoller only ever calls fetch with a string URL.
      // Justified cast: tests fully control the call sites.
      const url = input as string;
      if (url === '/api/checkout/session') {
        const body = JSON.parse((init?.body as string) ?? '{}') as {
          orderId: string;
        };
        if (body.orderId !== 'ord_123') {
          return Promise.resolve(new Response('bad orderId', { status: 400 }));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ redirectUrl: 'https://checkout.clover.test/abc' }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    };
    const fetchMock = vi.fn(fetchImpl);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<OrderStatusPoller orderId="ord_123" initialStatus="id_verified" />);

    expect(screen.getByText(/ID verified/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/checkout/session',
        expect.objectContaining({ method: 'POST' })
      );
    });

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        'https://checkout.clover.test/abc'
      );
    });
  });
});
