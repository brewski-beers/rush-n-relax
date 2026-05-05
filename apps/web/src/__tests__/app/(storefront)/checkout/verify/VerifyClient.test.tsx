import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/script', () => ({
  default: ({ src, ...rest }: { src: string; [k: string]: unknown }) => (
    <script src={src} {...rest} />
  ),
}));

import { VerifyClient } from '@/app/(storefront)/checkout/[sessionId]/verify/VerifyClient';

beforeEach(() => {
  // reset window-level config between cases
  delete (window as { AgeCheckerConfig?: unknown }).AgeCheckerConfig;
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
});
