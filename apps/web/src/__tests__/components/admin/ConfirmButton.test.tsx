import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmButton } from '@/components/admin/ConfirmButton';

describe('ConfirmButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('action mode (window.confirm)', () => {
    it('invokes action when the user confirms', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const action = vi.fn().mockResolvedValue(undefined);

      render(
        <ConfirmButton action={action} message="Delete?">
          Delete
        </ConfirmButton>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(action).toHaveBeenCalledOnce();
    });

    it('does not invoke action when user cancels', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const action = vi.fn().mockResolvedValue(undefined);

      render(
        <ConfirmButton action={action} message="Delete?">
          Delete
        </ConfirmButton>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(action).not.toHaveBeenCalled();
    });
  });

  describe('typed-confirmation mode (window.prompt)', () => {
    it('invokes action only when typed text matches confirmText', () => {
      vi.spyOn(window, 'prompt').mockReturnValue('user@example.com');
      const action = vi.fn().mockResolvedValue(undefined);

      render(
        <ConfirmButton
          action={action}
          message="Type the email"
          confirmText="user@example.com"
        >
          Promote
        </ConfirmButton>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Promote' }));
      expect(action).toHaveBeenCalledOnce();
    });

    it('rejects when typed text does not match confirmText', () => {
      vi.spyOn(window, 'prompt').mockReturnValue('wrong@example.com');
      const action = vi.fn().mockResolvedValue(undefined);

      render(
        <ConfirmButton
          action={action}
          message="Type the email"
          confirmText="user@example.com"
        >
          Promote
        </ConfirmButton>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Promote' }));
      expect(action).not.toHaveBeenCalled();
    });

    it('rejects when user cancels the prompt', () => {
      vi.spyOn(window, 'prompt').mockReturnValue(null);
      const action = vi.fn().mockResolvedValue(undefined);

      render(
        <ConfirmButton
          action={action}
          message="Type the email"
          confirmText="user@example.com"
        >
          Promote
        </ConfirmButton>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Promote' }));
      expect(action).not.toHaveBeenCalled();
    });
  });

  describe('submit mode', () => {
    it('allows form submission when confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

      render(
        <form onSubmit={onSubmit}>
          <ConfirmButton type="submit" message="Proceed?">
            Submit
          </ConfirmButton>
        </form>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
      expect(onSubmit).toHaveBeenCalledOnce();
    });

    it('prevents form submission when not confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

      render(
        <form onSubmit={onSubmit}>
          <ConfirmButton type="submit" message="Proceed?">
            Submit
          </ConfirmButton>
        </form>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('prevents form submission when typed-confirmation fails', () => {
      vi.spyOn(window, 'prompt').mockReturnValue('wrong@example.com');
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

      render(
        <form onSubmit={onSubmit}>
          <ConfirmButton
            type="submit"
            message="Type the email"
            confirmText="user@example.com"
          >
            Promote
          </ConfirmButton>
        </form>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Promote' }));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('allows form submission when typed-confirmation matches', () => {
      vi.spyOn(window, 'prompt').mockReturnValue('user@example.com');
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

      render(
        <form onSubmit={onSubmit}>
          <ConfirmButton
            type="submit"
            message="Type the email"
            confirmText="user@example.com"
          >
            Promote
          </ConfirmButton>
        </form>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Promote' }));
      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });
});
