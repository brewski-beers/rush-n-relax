'use client';

import { useRef, useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  /** Optimistic preview sources (object URLs or null), length 5. */
  srcs: (string | null)[];
  /** Actual confirmed Storage paths, length 5. */
  paths: (string | null)[];
  uploadingSlots: Set<number>;
  errors: Record<number, string>;
  disabled: boolean;
  onFile: (file: File, index: number) => void;
  onRemove: (index: number) => void;
  onReorder: (newPaths: (string | null)[]) => void;
}

// ── Drag handle icon (mirrors DashboardGrid) ───────────────────────────────

function DragHandleIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="4" cy="3" r="1.5" fill="currentColor" />
      <circle cx="10" cy="3" r="1.5" fill="currentColor" />
      <circle cx="4" cy="7" r="1.5" fill="currentColor" />
      <circle cx="10" cy="7" r="1.5" fill="currentColor" />
      <circle cx="4" cy="11" r="1.5" fill="currentColor" />
      <circle cx="10" cy="11" r="1.5" fill="currentColor" />
    </svg>
  );
}

// ── Sortable slot ──────────────────────────────────────────────────────────

interface SlotProps {
  index: number;
  src: string | null;
  uploading: boolean;
  error?: string;
  disabled: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}

function SortableImageSlot({
  index,
  src,
  uploading,
  error,
  disabled,
  onFile,
  onRemove,
}: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: index });

  function openFilePicker() {
    if (!disabled && !uploading) inputRef.current?.click();
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  }

  const slotClass = [
    'img-upload-slot',
    dragOver ? 'img-upload-slot--dragover' : '',
    isDragging ? 'img-upload-slot--dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Empty slot: expose as interactive so keyboard users can activate it
  const emptySlotInteraction = !src
    ? {
        role: 'button' as const,
        tabIndex: disabled ? -1 : 0,
        onClick: openFilePicker,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') openFilePicker();
        },
        'aria-label': `Add gallery image ${index + 1}`,
      }
    : { 'aria-label': `Gallery image ${index + 1}` };

  return (
    <div>
      <div
        ref={setNodeRef}
        // eslint-disable-next-line react/forbid-dom-props -- @dnd-kit requires inline transform/transition for drag animation
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={slotClass}
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        {...emptySlotInteraction}
      >
        {src ? (
          <>
            <img src={src} alt={`Gallery slot ${index + 1}`} />

            {/* Drag handle */}
            <button type="button"
              className="img-upload-slot-handle"
              aria-label="Drag to reorder"
              {...attributes}
              {...listeners}
            >
              <DragHandleIcon />
            </button>

            {/* Remove button */}
            <button type="button"
              className="img-upload-remove-btn"
              aria-label={`Remove gallery image ${index + 1}`}
              disabled={disabled}
              onClick={e => {
                e.stopPropagation();
                onRemove();
              }}
            >
              &times;
            </button>

            {uploading && (
              <div className="img-upload-spinner-overlay" aria-hidden="true">
                <span className="img-upload-spinner" />
              </div>
            )}

            {!uploading && (
              <div className="img-upload-slot-overlay">
                <button type="button"
                  className="admin-btn-secondary"
                  disabled={disabled}
                  onClick={e => {
                    e.stopPropagation();
                    openFilePicker();
                  }}
                >
                  Replace
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
              <div className="img-upload-slot-empty" aria-hidden="true">
                +
              </div>
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

// ── Gallery strip ──────────────────────────────────────────────────────────

export function GalleryStrip({
  srcs,
  paths,
  uploadingSlots,
  errors,
  disabled,
  onFile,
  onRemove,
  onReorder,
}: Props) {
  // SSR guard — same pattern as DashboardGrid
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-mount guard; DndContext must not render on server
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = paths.findIndex((_, i) => i === active.id);
      const newIndex = paths.findIndex((_, i) => i === over.id);
      onReorder(arrayMove(paths, oldIndex, newIndex));
    }
  }

  // Indices 0–4 are the sortable item IDs
  const itemIds = [0, 1, 2, 3, 4] as const;

  const slots = itemIds.map(i => (
    <SortableImageSlot
      key={i}
      index={i}
      src={srcs[i] ?? null}
      uploading={uploadingSlots.has(i)}
      error={errors[i]}
      disabled={disabled}
      onFile={file => onFile(file, i)}
      onRemove={() => onRemove(i)}
    />
  ));

  // Before mount: render a static grid without DnD to avoid hydration mismatch
  if (!mounted) {
    return <div className="img-upload-gallery">{slots}</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={[...itemIds]} strategy={rectSortingStrategy}>
        <div className="img-upload-gallery">{slots}</div>
      </SortableContext>
    </DndContext>
  );
}
