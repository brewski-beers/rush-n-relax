'use client';

import { useActionState } from 'react';
import { restoreTemplateRevision } from './actions';

interface Props {
  templateId: string;
  revisionId: string;
}

export function RestoreRevisionButton({ templateId, revisionId }: Props) {
  const [state, formAction, pending] = useActionState(
    restoreTemplateRevision,
    null
  );

  return (
    <div className="admin-template-restore-cell">
      <form
        action={formAction}
        className="admin-inline-form admin-inline-form-compact"
      >
        <input type="hidden" name="templateId" value={templateId} readOnly />
        <input type="hidden" name="revisionId" value={revisionId} readOnly />
        <button type="submit" disabled={pending}>
          {pending ? 'Restoring…' : 'Restore'}
        </button>
      </form>
      {state?.error ? (
        <p className="admin-inline-error">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="admin-section-desc admin-inline-success">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
