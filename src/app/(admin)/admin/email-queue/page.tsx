export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { listOutboundEmailJobs } from '@/lib/repositories';
import { RequeueEmailButton } from './RequeueEmailButton';

export default async function AdminEmailQueuePage() {
  await requireRole('owner');
  const jobs = await listOutboundEmailJobs();

  return (
    <>
      <div className="admin-page-header">
        <h1>Email Queue</h1>
      </div>
      <p className="admin-section-desc">
        Inspect outbound email jobs, delivery state, retry schedule, and manual
        requeue actions.
      </p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Subject</th>
              <th>To</th>
              <th>Attempts</th>
              <th>Updated</th>
              <th>Error</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} data-status={job.status}>
                <td>
                  <span
                    className={`admin-status-badge admin-status-${job.status}`}
                  >
                    {job.status}
                  </span>
                </td>
                <td>{job.subject}</td>
                <td>{job.to.join(', ')}</td>
                <td>
                  {job.attemptCount}/{job.maxAttempts}
                </td>
                <td>
                  {job.updatedAt instanceof Date
                    ? job.updatedAt.toLocaleString()
                    : new Date(job.updatedAt).toLocaleString()}
                </td>
                <td>{job.errorMessage ?? '—'}</td>
                <td>
                  {job.status === 'failed' || job.status === 'dead-letter' ? (
                    <RequeueEmailButton jobId={job.id} />
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-empty">
                  No outbound email jobs found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
