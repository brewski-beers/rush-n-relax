import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgeGate } from './index';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Fill in the three date inputs.
 * Changing the Year field to a 4-char value triggers the component's
 * auto-submit, so callers should NOT also click the Enter button.
 */
function fillDate(month: string, day: string, year: string) {
  fireEvent.change(screen.getByLabelText('Month'), {
    target: { value: month },
  });
  fireEvent.change(screen.getByLabelText('Day'), {
    target: { value: day },
  });
  fireEvent.change(screen.getByLabelText('Year'), {
    target: { value: year },
  });
}

/**
 * Fill in the three date inputs and click the Enter button explicitly.
 * Only use this when the year value is NOT 4 chars (so auto-submit won't fire).
 */
function fillDateAndSubmit(month: string, day: string, year: string) {
  fillDate(month, day, year);
  fireEvent.click(screen.getByRole('button', { name: /enter/i }));
}

// ── Tests ──────────────────────────────────────────────────────────────────

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
    it('renders the age gate overlay with a heading and the Enter button', () => {
      render(<AgeGate onVerified={onVerified} />);

      expect(
        screen.getByRole('heading', { name: /age verification/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Month')).toBeInTheDocument();
      expect(screen.getByLabelText('Day')).toBeInTheDocument();
      expect(screen.getByLabelText('Year')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /enter/i })
      ).toBeInTheDocument();
    });

    it('does not show an error message on initial render', () => {
      render(<AgeGate onVerified={onVerified} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('given empty fields on submit', () => {
    it('shows a validation error and does not call onVerified', () => {
      render(<AgeGate onVerified={onVerified} />);

      fireEvent.click(screen.getByRole('button', { name: /enter/i }));

      expect(
        screen.getByText(/please enter your complete birth date/i)
      ).toBeInTheDocument();
      expect(onVerified).not.toHaveBeenCalled();
    });
  });

  describe('given an underage birth date', () => {
    it('shows "You must be 21 or older to enter" and does not call onVerified', () => {
      render(<AgeGate onVerified={onVerified} />);

      // Born in 2010 — well under 21 as of 2026.
      // Year is 4 chars so auto-submit fires; no button click needed.
      fillDate('06', '15', '2010');

      // Use getByRole('alert') to target the error <p> specifically and avoid
      // matching the header subtitle which contains the same wording.
      expect(screen.getByRole('alert')).toHaveTextContent(
        /you must be 21 or older to enter/i
      );
      expect(onVerified).not.toHaveBeenCalled();
    });
  });

  describe('given a valid 21+ birth date', () => {
    it('calls onVerified and sets the ageVerified cookie', () => {
      render(<AgeGate onVerified={onVerified} />);

      // Born in 1990 — clearly 21+ as of any reasonable test run date.
      // Year is 4 chars so handleYearChange auto-submits; button click is NOT
      // fired separately to avoid double-submission.
      fillDate('03', '15', '1990');

      expect(onVerified).toHaveBeenCalledOnce();
      expect(document.cookie).toContain('ageVerified=true');
    });
  });

  describe('given an out-of-range month', () => {
    it('shows a valid birth date error and does not call onVerified', () => {
      render(<AgeGate onVerified={onVerified} />);

      // Year is 4 chars — auto-submit fires, no separate button click needed
      fillDate('13', '01', '1990');

      expect(screen.getByRole('alert')).toHaveTextContent(
        /please enter a valid birth date/i
      );
      expect(onVerified).not.toHaveBeenCalled();
    });
  });

  describe('given an out-of-range day', () => {
    it('shows a valid birth date error and does not call onVerified', () => {
      render(<AgeGate onVerified={onVerified} />);

      fillDate('05', '32', '1990');

      expect(screen.getByRole('alert')).toHaveTextContent(
        /please enter a valid birth date/i
      );
      expect(onVerified).not.toHaveBeenCalled();
    });
  });

  describe('given a year before 1900', () => {
    it('shows a valid birth date error and does not call onVerified', () => {
      render(<AgeGate onVerified={onVerified} />);

      fillDate('01', '01', '1899');

      expect(screen.getByRole('alert')).toHaveTextContent(
        /please enter a valid birth date/i
      );
      expect(onVerified).not.toHaveBeenCalled();
    });
  });

  describe('error state', () => {
    it('clears the previous error message on a new submit attempt', () => {
      render(<AgeGate onVerified={onVerified} />);

      // First submit with empty fields → error appears
      fireEvent.click(screen.getByRole('button', { name: /enter/i }));
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Now provide a valid adult date — year auto-submits
      fillDate('01', '01', '1990');

      // Error should be gone and onVerified called exactly once
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(onVerified).toHaveBeenCalledOnce();
    });
  });
});
