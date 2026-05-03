import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestModeBanner } from '@/components/TestModeBanner';

describe('TestModeBanner', () => {
  const original = process.env.CLOVER_LIVE_PAYMENTS_ENABLED;

  beforeEach(() => {
    delete process.env.CLOVER_LIVE_PAYMENTS_ENABLED;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CLOVER_LIVE_PAYMENTS_ENABLED;
    else process.env.CLOVER_LIVE_PAYMENTS_ENABLED = original;
  });

  it('renders the banner when live payments are disabled (default)', () => {
    render(<TestModeBanner />);
    const banner = screen.getByTestId('test-mode-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/test mode/i);
  });

  it('renders nothing when live payments are enabled', () => {
    process.env.CLOVER_LIVE_PAYMENTS_ENABLED = 'true';
    const { container } = render(<TestModeBanner />);
    expect(container.firstChild).toBeNull();
  });
});
