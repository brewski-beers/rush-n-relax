import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/script', () => ({
  default: ({ src, ...rest }: { src: string; [k: string]: unknown }) => (
    <script src={src} {...rest} />
  ),
}));

const { simulatePassMock, simulateDenyMock } = vi.hoisted(() => ({
  simulatePassMock: vi.fn(),
  simulateDenyMock: vi.fn(),
}));

vi.mock(
  '@/app/(storefront)/checkout/[sessionId]/verify/simulate-actions',
  () => ({
    simulateAgeVerifyPass: simulatePassMock,
    simulateAgeVerifyDeny: simulateDenyMock,
  })
);

import { VerifyClient } from '@/app/(storefront)/checkout/[sessionId]/verify/VerifyClient';

beforeEach(() => {
  // reset window-level config between cases
  delete (window as { AgeCheckerConfig?: unknown }).AgeCheckerConfig;
  simulatePassMock.mockReset();
  simulateDenyMock.mockReset();
  simulatePassMock.mockResolvedValue({ ok: true });
  simulateDenyMock.mockResolvedValue({ ok: true });
});

describe('VerifyClient', () => {
  it('sets window.AgeCheckerConfig with element, key, and order BEFORE rendering the popup script', () => {
    render(
      <VerifyClient
        sessionId="sess_abc"
        apiKey="pub-key-123"
        customerEmail="buyer@example.com"
        redirectUrl="/api/checkout/sess_abc/redirect"
      />
    );

    expect(window.AgeCheckerConfig).toEqual({
      element: '#proceed-to-payment',
      key: 'pub-key-123',
      order: 'sess_abc',
      email: 'buyer@example.com',
    });

    // Element id matches AgeCheckerConfig.element selector — the popup
    // can find it on the page when it loads.
    expect(document.querySelector('#proceed-to-payment')).not.toBeNull();
  });

  it('omits email from config when no customerEmail is supplied', () => {
    render(
      <VerifyClient
        sessionId="sess_xyz"
        apiKey="pub-key"
        customerEmail={undefined}
        redirectUrl="/api/checkout/sess_xyz/redirect"
      />
    );

    expect(window.AgeCheckerConfig).toBeDefined();
    expect(window.AgeCheckerConfig).not.toHaveProperty('email');
  });

  it('renders the proceed-to-payment anchor pointing at the redirect endpoint', () => {
    render(
      <VerifyClient
        sessionId="sess_1"
        apiKey="key"
        customerEmail={undefined}
        redirectUrl="/api/checkout/sess_1/redirect"
      />
    );

    const btn = screen.getByTestId('proceed-to-payment');
    expect(btn).toHaveAttribute('id', 'proceed-to-payment');
    expect(btn).toHaveAttribute('href', '/api/checkout/sess_1/redirect');
  });

  describe('preview-only simulate panel (#411)', () => {
    it('does NOT render the simulate panel when isPreview is false', () => {
      render(
        <VerifyClient
          sessionId="sess_prod"
          apiKey="key"
          customerEmail={undefined}
          redirectUrl="/api/checkout/sess_prod/redirect"
        />
      );

      expect(screen.queryByTestId('preview-tools')).toBeNull();
      expect(screen.queryByTestId('simulate-pass')).toBeNull();
      expect(screen.queryByTestId('simulate-deny')).toBeNull();
    });

    it('renders the simulate panel with both buttons when isPreview is true', () => {
      render(
        <VerifyClient
          sessionId="sess_pre"
          apiKey="key"
          customerEmail={undefined}
          redirectUrl="/api/checkout/sess_pre/redirect"
          isPreview
        />
      );

      expect(screen.getByTestId('preview-tools')).toBeInTheDocument();
      expect(screen.getByTestId('simulate-pass')).toBeInTheDocument();
      expect(screen.getByTestId('simulate-deny')).toBeInTheDocument();
      expect(screen.getByText(/Preview only/i)).toBeInTheDocument();
    });

    it('clicks Simulate Pass → calls simulateAgeVerifyPass and navigates to redirectUrl', async () => {
      const hrefSetter = vi.fn();
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...originalLocation,
          set href(v: string) {
            hrefSetter(v);
          },
        },
      });

      render(
        <VerifyClient
          sessionId="sess_pre"
          apiKey="key"
          customerEmail={undefined}
          redirectUrl="/api/checkout/sess_pre/redirect"
          isPreview
        />
      );

      fireEvent.click(screen.getByTestId('simulate-pass'));

      await waitFor(() => {
        expect(simulatePassMock).toHaveBeenCalledWith('sess_pre');
        expect(hrefSetter).toHaveBeenCalledWith(
          '/api/checkout/sess_pre/redirect'
        );
      });

      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    });

    it('clicks Simulate Deny → calls simulateAgeVerifyDeny and navigates to /checkout/cancelled', async () => {
      const hrefSetter = vi.fn();
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...originalLocation,
          set href(v: string) {
            hrefSetter(v);
          },
        },
      });

      render(
        <VerifyClient
          sessionId="sess_pre"
          apiKey="key"
          customerEmail={undefined}
          redirectUrl="/api/checkout/sess_pre/redirect"
          isPreview
        />
      );

      fireEvent.click(screen.getByTestId('simulate-deny'));

      await waitFor(() => {
        expect(simulateDenyMock).toHaveBeenCalledWith('sess_pre');
        expect(hrefSetter).toHaveBeenCalledWith(
          '/checkout/cancelled?session=sess_pre'
        );
      });

      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    });
  });
});
