'use client';

/**
 * Per-event-row "Resend email" button (#283).
 *
 * Hidden when the row's destination status has no mapped email template.
 */
import { useState, useTransition } from 'react';
import { resendOrderEmailAction } from './actions';

interface Props {
  orderId: string;
  eventId: string;
  /** When false, the button is suppressed (no template for this status). */
  enabled: boolean;
}

export function ResendEmailButton({ orderId, eventId, enabled }: Props) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!enabled) return null;

  return (
    <span className="admin-timeline-resend">
      <button
        type="button"
        disabled={pending}
        data-testid={`resend-email-btn-${eventId}`}
        className="admin-btn-link"
        onClick={() => {
          setFeedback(null);
          startTransition(async () => {
            const res = await resendOrderEmailAction(orderId, eventId);
            setFeedback(res.ok ? 'Resent.' : (res.error ?? 'Resend failed.'));
          });
        }}
      >
        Resend email
      </button>
      {feedback ? (
        <span className="admin-timeline-feedback">{feedback}</span>
      ) : null}
    </span>
  );
}
