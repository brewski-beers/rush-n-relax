import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const {
  getCheckoutSessionMock,
  setAgeCheckerSessionIdMock,
  createAgeCheckerSessionMock,
  redirectMock,
} = vi.hoisted(() => ({
  getCheckoutSessionMock: vi.fn(),
  setAgeCheckerSessionIdMock: vi.fn(),
  createAgeCheckerSessionMock: vi.fn(),
  redirectMock: vi.fn((_url: string) => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('@/lib/repositories/checkout-session.repository', () => ({
  getCheckoutSession: getCheckoutSessionMock,
  setAgeCheckerSessionId: setAgeCheckerSessionIdMock,
}));

vi.mock('@/lib/agechecker', () => ({
  createAgeCheckerSession: createAgeCheckerSessionMock,
  resolveAgeCheckerCallbackBase: () => 'https://rushnrelax.com',
}));

vi.mock('@/components/TestModeBanner', () => ({
  TestModeBanner: () => null,
}));

vi.mock('next/script', () => ({
  default: ({ src, ...rest }: { src: string; [k: string]: unknown }) => (
    <script src={src} {...rest} />
  ),
}));

import CheckoutVerifyPage from '@/app/(storefront)/checkout/[sessionId]/verify/page';
import type { CheckoutSession } from '@/types/checkout-session';

function buildSession(
  overrides: Partial<CheckoutSession> = {}
): CheckoutSession {
  const now = new Date();
  return {
    id: 'sess_1',
    items: [
      {
        productId: 'prod-1',
        variantId: 'default',
        productName: 'Demo Gummies',
        quantity: 2,
        unitPrice: 1500,
        lineTotal: 3000,
      },
    ],
    subtotal: 3000,
    tax: 270,
    total: 3270,
    locationId: 'online',
    deliveryAddress: {
      name: 'Jane Buyer',
      line1: '123 Main St',
      city: 'Knoxville',
      state: 'TN',
      zip: '37902',
    },
    customerEmail: 'jane@example.com',
    status: 'awaiting_id',
    ageVerifiedAt: null,
    verificationId: null,
    ageCheckerSessionId: null,
    holds: [],
    cloverCheckoutSessionId: 'sess_1',
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    ...overrides,
  };
}

beforeEach(() => {
  redirectMock.mockClear();
  getCheckoutSessionMock.mockReset();
  setAgeCheckerSessionIdMock.mockReset();
  createAgeCheckerSessionMock.mockReset();
  createAgeCheckerSessionMock.mockResolvedValue({
    sessionUuid: 'ac-sess-uuid-new',
  });
  setAgeCheckerSessionIdMock.mockResolvedValue(undefined);
  process.env.NEXT_PUBLIC_AGECHECKER_API_KEY = 'test-pub-key';
});

describe('CheckoutVerifyPage', () => {
  it('renders order summary, address, and Proceed-to-Payment button', async () => {
    getCheckoutSessionMock.mockResolvedValue(buildSession());

    const page = await CheckoutVerifyPage({
      params: Promise.resolve({ sessionId: 'sess_1' }),
    });
    render(page);

    expect(screen.getByText(/demo gummies/i)).toBeInTheDocument();
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    expect(screen.getByText(/jane buyer/i)).toBeInTheDocument();
    const proceed = screen.getByTestId('proceed-to-payment');
    expect(proceed).toHaveAttribute('id', 'proceed-to-payment');
    expect(proceed.getAttribute('href')).toBe('/api/checkout/sess_1/redirect');
  });

  it('mounts the AgeChecker popup script with afterInteractive strategy', async () => {
    getCheckoutSessionMock.mockResolvedValue(buildSession());

    const page = await CheckoutVerifyPage({
      params: Promise.resolve({ sessionId: 'sess_1' }),
    });
    render(page);

    const script = screen.getByTestId('agechecker-popup-script');
    expect(script).toHaveAttribute(
      'src',
      'https://cdn.agechecker.net/static/popup/v1/popup.js'
    );
  });

  it('redirects to /cart when the session is missing', async () => {
    getCheckoutSessionMock.mockResolvedValue(null);

    await expect(
      CheckoutVerifyPage({
        params: Promise.resolve({ sessionId: 'missing' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/cart\?toast=session-missing/)
    );
  });

  it('redirects to /cart when the session has expired', async () => {
    getCheckoutSessionMock.mockResolvedValue(
      buildSession({ expiresAt: new Date(Date.now() - 1000) })
    );

    await expect(
      CheckoutVerifyPage({
        params: Promise.resolve({ sessionId: 'sess_expired' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/cart\?toast=session-expired/)
    );
  });

  it('creates + persists an AgeChecker session when ageCheckerSessionId is null', async () => {
    getCheckoutSessionMock.mockResolvedValue(buildSession());

    const page = await CheckoutVerifyPage({
      params: Promise.resolve({ sessionId: 'sess_1' }),
    });
    render(page);

    expect(createAgeCheckerSessionMock).toHaveBeenCalledTimes(1);
    expect(createAgeCheckerSessionMock).toHaveBeenCalledWith({
      checkoutSessionId: 'sess_1',
      callbackUrl: 'https://rushnrelax.com/api/webhooks/agechecker',
      customerEmail: 'jane@example.com',
    });
    expect(setAgeCheckerSessionIdMock).toHaveBeenCalledWith(
      'sess_1',
      'ac-sess-uuid-new'
    );
  });

  it('does NOT call createAgeCheckerSession when ageCheckerSessionId is already set', async () => {
    getCheckoutSessionMock.mockResolvedValue(
      buildSession({ ageCheckerSessionId: 'ac-existing-uuid' })
    );

    const page = await CheckoutVerifyPage({
      params: Promise.resolve({ sessionId: 'sess_1' }),
    });
    render(page);

    expect(createAgeCheckerSessionMock).not.toHaveBeenCalled();
    expect(setAgeCheckerSessionIdMock).not.toHaveBeenCalled();
  });

  it('redirects to /cart when the session is in a terminal state', async () => {
    getCheckoutSessionMock.mockResolvedValue(
      buildSession({ status: 'completed' })
    );

    await expect(
      CheckoutVerifyPage({
        params: Promise.resolve({ sessionId: 'sess_done' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalled();
  });
});
