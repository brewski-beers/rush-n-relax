import type { EmailTemplateRevision } from '@/types';
import { RestoreRevisionButton } from './RestoreRevisionButton';

interface Props {
  templateId: string;
  revisions: EmailTemplateRevision[];
}

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

export function EmailTemplateRevisionHistory({ templateId, revisions }: Props) {
  return (
    <section className="admin-table-wrap admin-template-history">
      <div className="admin-template-history-header">
        <div>
          <h2 className="admin-section-title">Revision History</h2>
          <p className="admin-section-desc">
            Each save appends a snapshot. Restoring a snapshot creates a new
            live revision so recovery stays auditable.
          </p>
        </div>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Captured</th>
            <th>Source</th>
            <th>Status</th>
            <th>Subject</th>
            <th>Blocks</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {revisions.length === 0 ? (
            <tr>
              <td colSpan={6} className="admin-empty">
                No saved revisions yet. The first template save will create the
                initial snapshot.
              </td>
            </tr>
          ) : (
            revisions.map(revision => (
              <tr key={revision.id}>
                <td>{formatTimestamp(revision.createdAt)}</td>
                <td>
                  {revision.source}
                  {revision.restoredFromRevisionId ? ' (rollback)' : ''}
                </td>
                <td>{revision.status}</td>
                <td>{revision.subjectTemplate}</td>
                <td>
                  {revision.containers.reduce(
                    (total, container) => total + container.blocks.length,
                    0
                  )}
                </td>
                <td>
                  <RestoreRevisionButton
                    templateId={templateId}
                    revisionId={revision.id}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
