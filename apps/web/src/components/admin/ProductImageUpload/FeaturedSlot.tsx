'use client';

import { useRef, useState } from 'react';

interface Props {
  /** Optimistic preview src (object URL) or confirmed Storage URL, or null. */
  src: string | null;
  uploading: boolean;
  error?: string;
  /** Disabled while the parent form is submitting (from useFormStatus). */
  disabled: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}

export function FeaturedSlot({
  src,
  uploading,
  error,
  disabled,
  onFile,
  onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleClick() {
    if (!disabled && !uploading) {
      inputRef.current?.click();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Reset so the same file can be re-selected after an error
    e.target.value = '';
  }

  const zoneClass = [
    'img-upload-featured-zone',
    dragOver ? 'img-upload-featured-zone--dragover' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <div
        className={zoneClass}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Featured image upload zone"
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
      >
        {src ? (
          <>
            <img src={src} alt="Featured product preview" />
            {uploading && (
              <div className="img-upload-spinner-overlay" aria-hidden="true">
                <span className="img-upload-spinner" />
              </div>
            )}
            {!uploading && (
              <div className="img-upload-featured-overlay">
                <button type="button"
                  className="admin-btn-secondary"
                  disabled={disabled}
                  onClick={e => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                >
                  Replace
                </button>
                <button type="button"
                  className="img-upload-remove-btn img-upload-remove-btn--featured"
                  disabled={disabled}
                  aria-label="Remove featured image"
                  onClick={e => {
                    e.stopPropagation();
                    onRemove();
                  }}
                >
                  &times;
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {uploading ? (
              <div className="img-upload-spinner-overlay" aria-hidden="true">
                <span className="img-upload-spinner" />
              </div>
            ) : (
              <span className="img-upload-zone-label">
                Drop image here or click to browse
                <br />
                <small>JPEG, PNG, or WebP — max 15 MB</small>
              </span>
            )}
          </>
        )}
      </div>

      {error && <p className="img-upload-error">{error}</p>}

      {/* Hidden file input — triggered programmatically via inputRef.current.click() */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="img-upload-file-input-hidden"
        onChange={handleInputChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
