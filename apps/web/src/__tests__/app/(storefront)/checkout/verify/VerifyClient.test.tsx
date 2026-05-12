import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AgeCheckerConfig } from '@/types/agechecker-window';

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
        ageCheckerSessionId="ac-sess-uuid-1"
        customerEmail="buyer@example.com"
        redirectUrl="/api/checkout/sess_abc/redirect"
      />
    );

    expect(window.AgeCheckerConfig).toMatchObject({
      element: '#proceed-to-payment',
      key: 'pub-key-123',
      order: 'sess_abc',
      session: 'ac-sess-uuid-1',
      email: 'buyer@example.com',
    });
    // Lifecycle hook for the client-driven confirm path is wired.
    expect(typeof window.AgeCheckerConfig?.onstatuschanged).toBe('function');

    // Element id matches AgeCheckerConfig.element selector — the popup
    // can find it on the page when it loads.
    expect(document.querySelector('#proceed-to-payment')).not.toBeNull();
  });

  it('omits email from config when no customerEmail is supplied', () => {
    render(
      <VerifyClient
        sessionId="sess_xyz"
        apiKey="pub-key"
        ageCheckerSessionId="ac-uuid"
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
        ageCheckerSessionId="ac-uuid"
        customerEmail={undefined}
        redirectUrl="/api/checkout/sess_1/redirect"
      />
    );

    const btn = screen.getByTestId('proceed-to-payment');
    expect(btn).toHaveAttribute('id', 'proceed-to-payment');
    expect(btn).toHaveAttribute('href', '/api/checkout/sess_1/redirect');
  });

  describe('client-driven age confirmation (popup hooks)', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function renderAndGetConfig(sessionId = 'sess_hook'): AgeCheckerConfig {
      render(
        <VerifyClient
          sessionId={sessionId}
          apiKey="key"
          ageCheckerSessionId="ac-uuid"
          customerEmail={undefined}
          redirectUrl={`/api/checkout/${sessionId}/redirect`}
        />
      );
      const config = window.AgeCheckerConfig;
      if (!config) throw new Error('AgeCheckerConfig not set');
      return config;
    }

    it('POSTs the verification uuid to /confirm-age when status changes to accepted', async () => {
      const config = renderAndGetConfig('sess_hook');

      config.onstatuschanged?.({ uuid: 'verif-xyz', status: 'accepted' });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/checkout/sess_hook/confirm-age');
      expect(init.method).toBe('POST');
      expect(init.keepalive).toBe(true);
      expect(JSON.parse(init.body as string)).toEqual({
        verificationUuid: 'verif-xyz',
      });
    });

    it('POSTs once even if accepted fires multiple times', async () => {
      const config = renderAndGetConfig();
      config.onstatuschanged?.({ uuid: 'v1', status: 'accepted' });
      config.onstatuschanged?.({ uuid: 'v1', status: 'accepted' });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
    });

    it('POSTs on a denied status too (server cancels + releases)', async () => {
      const config = renderAndGetConfig('sess_d');
      config.onstatuschanged?.({ uuid: 'v-denied', status: 'denied' });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe('/api/checkout/sess_d/confirm-age');
    });

    it('does NOT POST for intermediate step-up statuses', async () => {
      const config = renderAndGetConfig();
      config.onstatuschanged?.({ uuid: 'v1', status: 'photo_id' });
      config.onstatuschanged?.({ uuid: 'v1', status: 'signature' });
      config.onstatuschanged?.({ uuid: 'v1', status: 'pending' });

      // give any async work a tick
      await new Promise(r => setTimeout(r, 10));
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('retries the confirm POST on a 5xx then succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const config = renderAndGetConfig();
      config.onstatuschanged?.({ uuid: 'v1', status: 'accepted' });

      await waitFor(
        () => {
          expect(fetchMock).toHaveBeenCalledTimes(2);
        },
        { timeout: 2000 }
      );
    });
  });

  describe('non-production simulate panel (#411)', () => {
    it('does NOT render the simulate panel when showSimulator is false', () => {
      render(
        <VerifyClient
          sessionId="sess_prod"
          apiKey="key"
          ageCheckerSessionId="ac-uuid"
          customerEmail={undefined}
          redirectUrl="/api/checkout/sess_prod/redirect"
        />
      );

      expect(screen.queryByTestId('preview-tools')).toBeNull();
      expect(screen.queryByTestId('simulate-pass')).toBeNull();
      expect(screen.queryByTestId('simulate-deny')).toBeNull();
    });

    it('renders the simulate panel with both buttons when showSimulator is true (preview/dev)', () => {
      render(
        <VerifyClient
          sessionId="sess_pre"
          apiKey="key"
          ageCheckerSessionId="ac-uuid"
          customerEmail={undefined}
          redirectUrl="/api/checkout/sess_pre/redirect"
          showSimulator
        />
      );

      expect(screen.getByTestId('preview-tools')).toBeInTheDocument();
      expect(screen.getByTestId('simulate-pass')).toBeInTheDocument();
      expect(screen.getByTestId('simulate-deny')).toBeInTheDocument();
      expect(screen.getByText(/Non-production only/i)).toBeInTheDocument();
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
          ageCheckerSessionId="ac-uuid"
          customerEmail={undefined}
          redirectUrl="/api/checkout/sess_pre/redirect"
          showSimulator
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
          ageCheckerSessionId="ac-uuid"
          customerEmail={undefined}
          redirectUrl="/api/checkout/sess_pre/redirect"
          showSimulator
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
