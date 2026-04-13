'use client';

import { useActionState } from 'react';
import type { CoaDocument } from '@/types';
import { uploadCoaDocument, deleteCoaDocument } from './actions';

interface Props {
  docs: CoaDocument[];
  isOwner: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function UploadForm() {
  const [state, action, isPending] = useActionState(uploadCoaDocument, null);

  return (
    <form action={action} className="admin-coa-upload-form">
      <h2>Upload COA Document</h2>
      {state?.error && (
        <p className="admin-form-error" role="alert">
          {state.error}
        </p>
      )}
      <div className="admin-field">
        <label htmlFor="coa-file" className="admin-label">
          PDF File <span aria-hidden="true">*</span>
        </label>
        <input
          id="coa-file"
          name="file"
          type="file"
          accept=".pdf"
          required
          className="admin-input"
          disabled={isPending}
        />
      </div>
      <div className="admin-field">
        <label htmlFor="coa-label" className="admin-label">
          Label{' '}
          <span className="admin-label-hint">
            (optional — overrides filename)
          </span>
        </label>
        <input
          id="coa-label"
          name="label"
          type="text"
          placeholder="e.g. Blue Dream \u2014 Batch 3"
          className="admin-input"
          disabled={isPending}
        />
      </div>
      <button type="submit" className="admin-btn-primary" disabled={isPending}>
        {isPending ? 'Uploading\u2026' : 'Upload PDF'}
      </button>
    </form>
  );
}

export function CoaAdminTable({ docs, isOwner }: Props) {
  return (
    <div className="admin-coa-wrap">
      <UploadForm />

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Size</th>
              <th>Uploaded</th>
              {isOwner && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {docs.map(doc => (
              <tr key={doc.name}>
                <td>{doc.label}</td>
                <td>{formatFileSize(doc.size)}</td>
                <td>{formatDate(doc.updatedAt)}</td>
                {isOwner && (
                  <td className="admin-actions">
                    <form
                      action={deleteCoaDocument}
                      onSubmit={e => {
                        if (!confirm(`Delete "${doc.label}"?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="name" value={doc.name} />
                      <button type="submit" className="admin-btn-danger">
                        Delete
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={isOwner ? 4 : 3} className="admin-empty">
                  No COA documents uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
