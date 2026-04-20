'use client';

import { useActionState } from 'react';
import { requeueEmailJob } from './actions';

export function RequeueEmailButton({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState(requeueEmailJob, null);

  return (
    <form
      action={formAction}
      className="admin-inline-form admin-inline-form-compact"
    >
      <input type="hidden" name="jobId" value={jobId} readOnly />
      <button type="submit" disabled={pending}>
        {pending ? 'Requeueing…' : 'Requeue'}
      </button>
      {state?.error ? (
        <span className="admin-inline-error">{state.error}</span>
      ) : null}
    </form>
  );
}
