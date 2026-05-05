import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// next/script renders a vanilla <script> in tests; capture src so we can assert
// that AgeCheckerConfig is set before the script tag is emitted.
vi.mock('next/script', () => ({
  default: (props: { src: string; strategy?: string }) => {
    return (
      <script
        data-testid="agechecker-script"
        data-strategy={props.strategy}
        src={props.src}
      />
    );
  },
}));

import { AgeCheckerGuard } from './AgeCheckerGuard';

describe('AgeCheckerGuard', () => {
  const ORIGINAL_KEY = process.env.NEXT_PUBLIC_AGECHECKER_API_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_AGECHECKER_API_KEY = 'test-api-key';
    delete (window as { AgeCheckerConfig?: unknown }).AgeCheckerConfig;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_AGECHECKER_API_KEY = ORIGINAL_KEY;
    delete (window as { AgeCheckerConfig?: unknown }).AgeCheckerConfig;
  });

  it('sets window.AgeCheckerConfig before the popup script renders', () => {
    const { getByTestId } = render(
      <AgeCheckerGuard sessionId="sess_123" customerEmail="kb@example.com" />
    );

    // Config must be defined the moment the script tag exists in the DOM,
    // because afterInteractive scripts read window globals on first execution.
    expect(window.AgeCheckerConfig).toBeDefined();
    expect(getByTestId('agechecker-script')).toBeInTheDocument();
  });

  it('propagates sessionId, email, and api key into AgeCheckerConfig', () => {
    render(
      <AgeCheckerGuard sessionId="sess_abc" customerEmail="buyer@example.com" />
    );

    expect(window.AgeCheckerConfig).toEqual({
      element: '#proceed-to-payment',
      key: 'test-api-key',
      order: 'sess_abc',
      email: 'buyer@example.com',
    });
  });

  it('targets the #proceed-to-payment button element', () => {
    render(<AgeCheckerGuard sessionId="s" customerEmail="a@b.co" />);
    expect(window.AgeCheckerConfig?.element).toBe('#proceed-to-payment');
  });

  it('loads the v1 popup script with afterInteractive strategy', () => {
    const { getByTestId } = render(
      <AgeCheckerGuard sessionId="s" customerEmail="a@b.co" />
    );
    const script = getByTestId('agechecker-script');
    expect(script).toHaveAttribute(
      'src',
      'https://cdn.agechecker.net/static/popup/v1/popup.js'
    );
    expect(script).toHaveAttribute('data-strategy', 'afterInteractive');
  });
});
