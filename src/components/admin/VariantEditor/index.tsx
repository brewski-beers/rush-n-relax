'use client';

/**
 * VariantEditor — variant configurator for admin product forms.
 *
 * Manages the ProductVariant[] array for a product. Outputs a JSON blob
 * via a hidden input (name="variants") that the server action parses.
 *
 * Templates are loaded from Firestore (variant-templates collection) and passed
 * in as the `variantTemplates` prop. Template chips replace the original <select>
 * so each chip can have an inline delete button.
 *
 * A "Save as Template" button lets admins persist the current variant set.
 * Cards are drag-and-drop reorderable.
 */

import { useState, useId, useRef } from 'react';
import type { ProductVariant } from '@/types/product';
import type { VariantTemplate as StoredVariantTemplate } from '@/types/variant-template';
import {
  saveVariantTemplateAction,
  deleteVariantTemplateAction,
} from '@/app/(admin)/admin/products/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildRows(
  rows: Omit<ProductVariant, 'variantId'>[]
): ProductVariant[] {
  return rows.map(row => ({
    ...row,
    variantId: slugify(row.label),
  }));
}

// ── Card component ─────────────────────────────────────────────────────────

interface CardProps {
  variant: ProductVariant;
  index: number;
  total: number;
  isDragOver: boolean;
  onChange: (
    index: number,
    field: keyof ProductVariant,
    value: unknown
  ) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
}

function VariantCard({
  variant,
  index,
  total,
  isDragOver,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: CardProps) {
  const id = useId();

  function handleLabelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newLabel = e.target.value;
    onChange(index, 'label', newLabel);
    // Auto-update variantId only if it still matches the auto-generated value
    if (variant.variantId === slugify(variant.label)) {
      onChange(index, 'variantId', slugify(newLabel));
    }
  }

  return (
    <div
      className={`variant-editor-item${isDragOver ? ' variant-editor-item--drag-over' : ''}`}
      aria-label={`Variant ${index + 1}`}
    >
      {/* Move arrows — outside the card, on the left */}
      <div className="variant-editor-move">
        <button
          type="button"
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          aria-label={`Move variant ${index + 1} up`}
          className="variant-editor-move-btn"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(index)}
          disabled={index === total - 1}
          aria-label={`Move variant ${index + 1} down`}
          className="variant-editor-move-btn"
        >
          ↓
        </button>
      </div>

      {/* Card */}
      <div
        className="variant-editor-card"
        draggable
        onDragStart={() => onDragStart(index)}
        onDragOver={e => onDragOver(e, index)}
        onDrop={() => onDrop(index)}
        onDragEnd={onDragEnd}
      >
        <div className="variant-editor-card-drag-handle" aria-hidden="true">
          ⠿
        </div>

        <div className="variant-editor-card-fields">
          <label htmlFor={`${id}-label`}>
            <span className="admin-hint">Label</span>
            <input
              id={`${id}-label`}
              type="text"
              value={variant.label}
              onChange={handleLabelChange}
              placeholder="e.g. 3.5g"
              required
            />
          </label>

          <label htmlFor={`${id}-vid`}>
            <span className="admin-hint">Variant ID</span>
            <input
              id={`${id}-vid`}
              type="text"
              value={variant.variantId}
              onChange={e => onChange(index, 'variantId', e.target.value)}
              pattern="[a-z0-9-]+"
              title="lowercase letters, numbers, and hyphens only"
            />
          </label>
        </div>

        {/* Delete — far right, red */}
        <button
          type="button"
          onClick={() => onDelete(index)}
          aria-label={`Delete variant ${index + 1}`}
          className="variant-editor-delete-btn"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Save-as-Template inline form ───────────────────────────────────────────

interface SaveTemplateFormProps {
  variants: ProductVariant[];
  onSaved: (tpl: StoredVariantTemplate) => void;
  onCancel: () => void;
}

function SaveTemplateForm({
  variants,
  onSaved,
  onCancel,
}: SaveTemplateFormProps) {
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = slugify(label);

  async function handleSave() {
    if (!key) {
      setError('Label is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const rows = variants.map(({ variantId: _vid, ...rest }) => rest);
    const result = await saveVariantTemplateAction(key, label, rows);
    setSaving(false);
    if (result.ok) {
      // Build an optimistic template object to update parent state immediately
      const optimistic: StoredVariantTemplate = {
        id: result.id,
        key,
        label,
        rows,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      onSaved(optimistic);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="variant-editor-save-tpl-form">
      <label>
        <span className="admin-hint">Template label</span>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Flower (weight)"
          autoFocus
        />
      </label>
      {label && (
        <span className="admin-hint">
          Key: <code>{key || '—'}</code>
        </span>
      )}
      {error && <p className="admin-error">{error}</p>}
      <div className="variant-editor-save-tpl-actions">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !key}
          className="admin-btn-primary"
        >
          {saving ? 'Saving…' : 'Save Template'}
        </button>
        <button type="button" onClick={onCancel} className="admin-btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface VariantEditorProps {
  /** Initial variants (from existing product), or empty for new products */
  initialVariants?: ProductVariant[];
  /** Stored variant templates from Firestore — passed from server component */
  variantTemplates?: StoredVariantTemplate[];
  /** Initial storefront selector label, e.g. "Select Weight" */
  initialSelectorLabel?: string;
}

export function VariantEditor({
  initialVariants = [],
  variantTemplates = [],
  initialSelectorLabel = '',
}: VariantEditorProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [selectorLabel, setSelectorLabel] = useState(initialSelectorLabel);
  const [templates, setTemplates] =
    useState<StoredVariantTemplate[]>(variantTemplates);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function applyTemplate(tpl: StoredVariantTemplate) {
    setVariants(prev => [...prev, ...buildRows(tpl.rows)]);
  }

  async function handleDeleteTemplate(id: string) {
    const result = await deleteVariantTemplateAction(id);
    if (result.ok) {
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
    // On failure silently preserve state — the chip stays visible
  }

  function handleChange(
    index: number,
    field: keyof ProductVariant,
    value: unknown
  ) {
    setVariants(prev =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  }

  function handleDelete(index: number) {
    setVariants(prev => prev.filter((_, i) => i !== index));
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    setVariants(prev => {
      const next = [...prev];
      // safe swap — bounds checked above
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function handleMoveDown(index: number) {
    setVariants(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      // safe swap — bounds checked above
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function addRow() {
    setVariants(prev => [...prev, { variantId: '', label: '' }]);
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(dropIndex: number) {
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) return;
    setVariants(prev => {
      const next = [...prev];
      const [dragged] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, dragged);
      return next;
    });
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  return (
    <fieldset className="admin-fieldset variant-editor">
      <legend>Variants</legend>
      <span className="admin-hint">
        Define purchasable options. Pricing is set per-location in Inventory.
      </span>

      <label>
        Selector Label{' '}
        <span className="admin-hint">
          (storefront heading — e.g. &quot;Select Weight&quot;, &quot;Select
          Flavor&quot;)
        </span>
        <input
          type="text"
          value={selectorLabel}
          onChange={e => setSelectorLabel(e.target.value)}
          placeholder="Select Size"
        />
      </label>

      {/* Template chips */}
      <div className="variant-editor-template-row">
        <span className="admin-hint">Templates</span>
        {templates.length === 0 ? (
          <span className="admin-hint">No templates saved yet.</span>
        ) : (
          <div className="variant-editor-template-chips">
            {templates.map(tpl => (
              <span key={tpl.id} className="tag-chip variant-template-chip">
                <button
                  type="button"
                  className="variant-editor-chip-apply"
                  onClick={() => applyTemplate(tpl)}
                  title={`Apply template: ${tpl.label}`}
                >
                  {tpl.label}
                </button>
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => void handleDeleteTemplate(tpl.id)}
                  aria-label={`Delete template ${tpl.label}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <span className="admin-hint">Clicking a template appends rows.</span>
      </div>

      <div className="variant-editor-list">
        {variants.map((variant, i) => (
          <VariantCard
            key={i}
            variant={variant}
            index={i}
            total={variants.length}
            isDragOver={dragOverIndex === i}
            onChange={handleChange}
            onDelete={handleDelete}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      <button type="button" onClick={addRow} className="admin-add-row-btn">
        + Add variant
      </button>

      {/* Save as Template */}
      {showSaveForm ? (
        <SaveTemplateForm
          variants={variants}
          onSaved={tpl => {
            setTemplates(prev => {
              // Replace existing template with same key, or append
              const idx = prev.findIndex(t => t.key === tpl.key);
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = tpl;
                return next;
              }
              return [...prev, tpl];
            });
            setShowSaveForm(false);
          }}
          onCancel={() => setShowSaveForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowSaveForm(true)}
          className="variant-editor-save-tpl-btn"
          disabled={variants.length === 0}
        >
          Save as Template
        </button>
      )}

      <input type="hidden" name="variantSelectorLabel" value={selectorLabel} />
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />
    </fieldset>
  );
}
