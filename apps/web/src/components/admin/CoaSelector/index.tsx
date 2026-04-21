'use client';

import { useRef, useState } from 'react';

interface Props {
  currentCoaUrl?: string;
}

/**
 * Admin COA upload widget.
 * Drag-and-drop or click-to-browse PDF uploader.
 * Uploads to COA/ prefix via /api/admin/coa/upload.
 * Hidden input "coaUrl" carries the resulting signed URL into the parent form.
 */
export function CoaSelector({ currentCoaUrl }: Props) {
  const [url, setUrl] = useState<string>(currentCoaUrl ?? '');
  const [filename, setFilename] = useState<string>(
    currentCoaUrl ? labelFromUrl(currentCoaUrl) : ''
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File exceeds the 10 MB limit.');
      return;
    }

    setError(null);
    setUploading(true);

    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/admin/coa/upload', {
      method: 'POST',
      body: fd,
    });

    setUploading(false);

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(body.error ?? 'Upload failed. Please try again.');
      return;
    }

    const { url: signedUrl } = (await res.json()) as { url: string };
    setUrl(signedUrl);
    setFilename(file.name);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  }

  function handleClear() {
    setUrl('');
    setFilename('');
    setError(null);
  }

  const zoneClass = [
    'coa-upload-zone',
    dragOver ? 'coa-upload-zone--dragover' : '',
    uploading ? 'coa-upload-zone--uploading' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="coa-upload-wrap">
      {/* Hidden input carries the signed URL into parent form submission */}
      <input type="hidden" name="coaUrl" value={url} />

      {url ? (
        <div className="coa-upload-result">
          <span className="coa-upload-icon" aria-hidden="true">
            📄
          </span>
          <span className="coa-upload-filename">{filename}</span>
          <button type="button"
            className="coa-upload-remove"
            onClick={handleClear}
            aria-label="Remove COA"
          >
            &times;
          </button>
        </div>
      ) : (
        <div
          className={zoneClass}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-label="COA PDF upload zone"
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
        >
          {uploading ? (
            <span className="coa-upload-hint">Uploading…</span>
          ) : (
            <>
              <span className="coa-upload-icon" aria-hidden="true">
                📄
              </span>
              <span className="coa-upload-hint">
                Drop PDF here or click to browse
                <br />
                <small>PDF only — max 10 MB</small>
              </span>
            </>
          )}
        </div>
      )}

      {error && <p className="admin-error">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="img-upload-file-input-hidden"
        onChange={handleInputChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

function labelFromUrl(url: string): string {
  try {
    // Extract filename from a Storage path or URL
    const decoded = decodeURIComponent(url);
    const parts = decoded.split('/');
    return parts[parts.length - 1].split('?')[0];
  } catch {
    return 'COA Document';
  }
}
