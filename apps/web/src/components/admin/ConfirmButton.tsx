'use client';

import { type MouseEvent, type ReactNode } from 'react';

interface BaseProps {
  message: string;
  children: ReactNode;
  className?: string;
  /**
   * When set, the user must type this exact string to confirm.
   * Used for high-risk operations (e.g. promoting a user to owner).
   */
  confirmText?: string;
}

interface ActionProps extends BaseProps {
  /** Invoked on confirm. Button renders as type="button". */
  action: () => Promise<void>;
  type?: never;
}

interface SubmitProps extends BaseProps {
  /** Use as a form submit button — cancels submission if unconfirmed. */
  type: 'submit';
  action?: never;
}

type Props = ActionProps | SubmitProps;

/**
 * Wraps a destructive or privileged action with a confirmation dialog.
 *
 * - Default: `window.confirm(message)` — single click-confirm.
 * - With `confirmText`: `window.prompt(message)` — user must type the
 *   expected string to proceed. Used for high-risk promotions
 *   (e.g. typing the target user's email before promoting to `owner`).
 *
 * Supports two modes:
 * - `action` prop → calls the async action directly (button is type="button").
 * - `type="submit"` → acts as a form submit button; cancels submission
 *   if the user does not confirm.
 */
export function ConfirmButton(props: Props) {
  const { message, children, className, confirmText } = props;

  const confirmed = (): boolean => {
    if (confirmText) {
      const entered = prompt(message);
      if (entered === null) return false;
      return entered.trim() === confirmText;
    }
    return confirm(message);
  };

  if ('type' in props && props.type === 'submit') {
    return (
      <button
        type="submit"
        className={className}
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          if (!confirmed()) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {children}
      </button>
    );
  }

  const { action } = props;
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (!confirmed()) return;
        void action();
      }}
    >
      {children}
    </button>
  );
}
