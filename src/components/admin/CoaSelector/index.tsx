'use client';

import { useState, useRef } from 'react';
import { fetchCoaDocuments } from '@/app/(admin)/admin/products/actions/fetchCoaDocuments';
import type { CoaDocument } from '@/types';

type Mode = 'none' | 'existing' | 'upload';

interface Props {
  currentCoaUrl?: string;
}

/**
 * Admin widget for selecting a COA document.
 *
 * Lazy-load pattern: zero Storage calls on page load.
 * - "None" — clears coaUrl on save (hidden input value="")
 * - "Use Existing" — fires fetchCoaDocuments once on first click, caches result
 * - "Upload New" — uploads to COA/ prefix, then auto-switches to existing with new file selected
 *
 * The hidden input named "coaUrl" carries the selected value into the parent form.
 */
export function CoaSelector({ currentCoaUrl }: Props) {
  // Start in "existing" mode if a URL is already set, otherwise "none"
  const [mode, setMode] = useState<Mode>(currentCoaUrl ? 'existing' : 'none');

  // COA document list — loaded lazily on first "existing" toggle
  const [docs, setDocs] = useState<CoaDocument[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // The currently selected coaUrl value — drives the hidden input
  const [selectedUrl, setSelectedUrl] = useState<string>(currentCoaUrl ?? '');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleModeChange(next: Mode) {
    setMode(next);

    if (next === 'none') {
      setSelectedUrl('');
    }

    if (next === 'existing' && docs === null && !loading) {
      setLoading(true);
      setFetchError(null);
      try {
        const result = await fetchCoaDocuments();
        setDocs(result);
        // Preselect current URL if it matches a doc in the list
        if (currentCoaUrl) {
          const match = result.find(
            d => d.downloadUrl === currentCoaUrl || d.name === currentCoaUrl
          );
          if (match) setSelectedUrl(match.downloadUrl);
        }
      } catch {
        setFetchError('Failed to load COA documents. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      setUploadError('Only PDF files are accepted.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/admin/coa/upload', {
      method: 'POST',
      body: fd,
    });

    setUploading(false);

    if (!res.ok) {
      setUploadError('Upload failed. Please try again.');
      return;
    }

    const { url, name } = (await res.json()) as { url: string; name: string };

    // Add newly uploaded doc to the cached list and select it
    const newDoc: CoaDocument = {
      name,
      label: file.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' '),
      downloadUrl: url,
      size: file.size,
      updatedAt: new Date(),
    };

    setDocs(prev => (prev ? [newDoc, ...prev] : [newDoc]));
    setSelectedUrl(url);
    setMode('existing');
  }

  return (
    <div className="coa-selector">
      {/* Hidden input carries selected coaUrl into parent form submission */}
      <input type="hidden" name="coaUrl" value={selectedUrl} />

      <div
        className="coa-selector-modes"
        role="radiogroup"
        aria-label="COA selection mode"
      >
        <label className="coa-selector-mode-label">
          <input
            type="radio"
            name="_coaSelectorMode"
            value="none"
            checked={mode === 'none'}
            onChange={() => void handleModeChange('none')}
          />
          None
        </label>
        <label className="coa-selector-mode-label">
          <input
            type="radio"
            name="_coaSelectorMode"
            value="existing"
            checked={mode === 'existing'}
            onChange={() => void handleModeChange('existing')}
          />
          Use Existing
        </label>
        <label className="coa-selector-mode-label">
          <input
            type="radio"
            name="_coaSelectorMode"
            value="upload"
            checked={mode === 'upload'}
            onChange={() => void handleModeChange('upload')}
          />
          Upload New
        </label>
      </div>

      {mode === 'existing' && (
        <div className="coa-selector-existing">
          {loading && <p className="admin-hint">Loading COA documents…</p>}
          {fetchError && <p className="admin-error">{fetchError}</p>}
          {docs !== null && docs.length === 0 && (
            <p className="admin-hint">No COA documents found in Storage.</p>
          )}
          {docs !== null && docs.length > 0 && (
            <label>
              Select COA Document
              <select
                name="_coaSelectorSelect"
                value={selectedUrl}
                onChange={e => setSelectedUrl(e.target.value)}
              >
                <option value="">Select…</option>
                {docs.map(doc => (
                  <option key={doc.name} value={doc.downloadUrl}>
                    {doc.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {mode === 'upload' && (
        <div className="coa-selector-upload">
          <label>
            PDF File
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={e => void handleFileChange(e)}
              disabled={uploading}
            />
          </label>
          {uploading && <p className="admin-hint">Uploading…</p>}
          {uploadError && <p className="admin-error">{uploadError}</p>}
        </div>
      )}
    </div>
  );
}
