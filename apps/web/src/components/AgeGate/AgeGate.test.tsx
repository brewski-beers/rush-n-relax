import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgeGate } from './index';

describe('AgeGate component', () => {
  let onVerified: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onVerified = vi.fn();
    // Reset document.cookie between tests so cookie state doesn't leak
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  describe('rendering', () => {
    it('renders the age gate with affirm and deny buttons', () => {
      render(<AgeGate onVerified={onVerified} />);

      expect(
        screen.getByRole('heading', { name: /age verification/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /yes, i'm 21 or older/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /no, exit/i })
      ).toBeInTheDocument();
    });
  });

  describe('when the visitor affirms they are 21+', () => {
    it('calls onVerified and sets the ageVerified cookie', () => {
      render(<AgeGate onVerified={onVerified} />);

      fireEvent.click(
        screen.getByRole('button', { name: /yes, i'm 21 or older/i })
      );

      expect(onVerified).toHaveBeenCalledOnce();
      expect(document.cookie).toContain('ageVerified=true');
    });
  });

  describe('when the visitor denies being 21+', () => {
    it('redirects away and does not call onVerified', () => {
      // jsdom's location is read-only by default; redefine href as a setter spy.
      const hrefSetter = vi.fn();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...window.location,
          set href(value: string) {
            hrefSetter(value);
          },
        },
      });

      render(<AgeGate onVerified={onVerified} />);

      fireEvent.click(screen.getByRole('button', { name: /no, exit/i }));

      expect(hrefSetter).toHaveBeenCalledWith('https://www.google.com');
      expect(onVerified).not.toHaveBeenCalled();
      expect(document.cookie).not.toContain('ageVerified=true');
    });
  });
});
