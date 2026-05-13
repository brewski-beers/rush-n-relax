'use client';

/**
 * Accessible confirmation dialog (#440).
 *
 * Replaces `window.confirm()` for destructive admin actions. Implements:
 *  - role="alertdialog" with aria-labelledby + aria-describedby
 *  - Focus trap (Tab cycles within the dialog)
 *  - ESC closes (treated as cancel)
 *  - Focus restored to the trigger element after close
 *
 * Render this inline next to the trigger. When `open` flips to true the
 * dialog mounts, captures focus on the cancel button, and traps Tab/Shift+Tab.
 */

import { useEffect, useRef } from 'react';

export interface AdminConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AdminConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    cancelBtnRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button:not([disabled])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="admin-confirm-backdrop"
      onClick={onCancel}
     
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby="admin-confirm-message"
        className="admin-confirm-dialog"
        data-testid="admin-confirm-dialog"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="admin-confirm-title" className="admin-confirm-dialog__title">
          {title}
        </h2>
        <p
          id="admin-confirm-message"
          className="admin-confirm-dialog__message"
        >
          {message}
        </p>
        <div className="admin-confirm-dialog__actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="admin-btn-secondary"
            onClick={onCancel}
            data-testid="admin-confirm-cancel"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? 'admin-btn-danger' : 'admin-btn-primary'}
            onClick={onConfirm}
            data-testid="admin-confirm-ok"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
