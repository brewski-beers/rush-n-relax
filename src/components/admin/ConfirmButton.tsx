'use client';

interface Props {
  action: () => Promise<void>;
  message: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a Server Action with a window.confirm dialog before submitting.
 * Used for destructive admin operations (delete, archive).
 */
export function ConfirmButton({ action, message, children, className }: Props) {
  const handleClick = () => {
    if (!confirm(message)) return;
    void action();
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
