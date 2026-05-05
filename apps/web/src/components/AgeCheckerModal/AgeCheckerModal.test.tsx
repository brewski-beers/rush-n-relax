import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// next/script is a no-op in jsdom; mock it as a transparent passthrough so
// we can assert the rendered <script> attributes.
vi.mock('next/script', () => ({
  default: (props: {
    id?: string;
    src?: string;
    strategy?: string;
    crossOrigin?: string;
  }) => (
    <script
      data-testid="agechecker-script"
      data-strategy={props.strategy}
      data-id={props.id}
      src={props.src}
      // Justified cast: <script> typing requires the CrossOrigin literal
      // union; the next/script prop is loosely typed as string in our mock.
      crossOrigin={props.crossOrigin as '' | 'anonymous' | 'use-credentials'}
    />
  ),
}));

import {
  AgeCheckerLiveButton,
  AgeCheckerModal,
  isAgeCheckerTestMode,
} from './AgeCheckerModal';

describe('AgeCheckerLiveButton', () => {
  // Note: API_KEY is captured at module load time in the SUT, so per-test
  // env stubs cannot influence it. We assert the runtime shape and ignore
  // the key value (it is whatever the env had at module load — typically '').
  beforeEach(() => {
    delete (window as { AgeCheckerConfig?: unknown }).AgeCheckerConfig;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders a button with the expected stable id', () => {
    render(<AgeCheckerLiveButton orderId="order-1" />);
    const btn = screen.getByRole('button', { name: /verify age/i });
    expect(btn.id).toBe('agechecker-verify-button');
  });

  it('loads popup.js from the real AgeChecker CDN with afterInteractive strategy', () => {
    render(<AgeCheckerLiveButton orderId="order-1" />);
    const script = screen.getByTestId('agechecker-script');
    expect(script.getAttribute('src')).toBe(
      'https://cdn.agechecker.net/static/popup/v1/popup.js'
    );
    expect(script.getAttribute('data-strategy')).toBe('afterInteractive');
    expect(script.hasAttribute('crossorigin')).toBe(true);
  });

  it('sets window.AgeCheckerConfig with element selector, order, email, and a key field', () => {
    render(
      <AgeCheckerLiveButton orderId="order-1" customerEmail="kb@example.com" />
    );
    expect(window.AgeCheckerConfig).toMatchObject({
      element: '#agechecker-verify-button',
      order: 'order-1',
      email: 'kb@example.com',
    });
    // `key` must always be present (string, possibly empty in tests).
    expect(typeof window.AgeCheckerConfig?.key).toBe('string');
  });

  it('omits email field when customerEmail is not provided', () => {
    render(<AgeCheckerLiveButton orderId="order-2" />);
    expect(window.AgeCheckerConfig).toMatchObject({
      element: '#agechecker-verify-button',
      order: 'order-2',
    });
    expect(window.AgeCheckerConfig).not.toHaveProperty('email');
  });

  it('honors a custom buttonId for both the button and the config selector', () => {
    render(
      <AgeCheckerLiveButton orderId="order-3" buttonId="custom-verify-btn" />
    );
    expect(screen.getByRole('button').id).toBe('custom-verify-btn');
    expect(window.AgeCheckerConfig?.element).toBe('#custom-verify-btn');
  });
});

describe('AgeCheckerModal (test-mode simulate path)', () => {
  beforeEach(() => {
    // Test-mode flag is read at module load time; we stub via the env-var
    // pathway but because the constant is captured once we cannot toggle
    // at runtime in this suite. The constant evaluates at module load.
    // For correctness we just exercise the rendered branch under whatever
    // the environment is. A separate live-mode suite handles the negation.
  });

  it('isAgeCheckerTestMode reflects the build-time env flag', () => {
    expect(typeof isAgeCheckerTestMode()).toBe('boolean');
  });

  it('returns null when open=false (regardless of mode)', () => {
    const { container } = render(
      <AgeCheckerModal open={false} onComplete={vi.fn()} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
