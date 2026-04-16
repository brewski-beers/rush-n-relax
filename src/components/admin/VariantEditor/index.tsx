'use client';

/**
 * VariantEditor — variant configurator for admin product forms.
 *
 * Manages the ProductVariant[] array for a product. Outputs a JSON blob
 * via a hidden input (name="variants") that the server action parses.
 *
 * Template presets are defined here; selecting one pre-populates rows.
 * Each row has: label (free-form) and variantId (auto-slugified, editable).
 * Cards are drag-and-drop reorderable.
 */

import { useState, useId, useRef } from 'react';
import type { ProductVariant } from '@/types/product';

// ── Template definitions ───────────────────────────────────────────────────

interface VariantTemplate {
  key: string;
  label: string;
  rows: Omit<ProductVariant, 'variantId'>[];
}

const TEMPLATES: VariantTemplate[] = [
  {
    key: 'flower',
    label: 'Flower (weight)',
    rows: [
      { label: '1g', weight: { value: 1, unit: 'g' } },
      { label: '3.5g', weight: { value: 3.5, unit: 'g' } },
      { label: '7g', weight: { value: 7, unit: 'g' } },
      { label: '14g', weight: { value: 14, unit: 'g' } },
      { label: '28g', weight: { value: 28, unit: 'g' } },
    ],
  },
  {
    key: 'preroll-qty',
    label: 'Preroll (qty)',
    rows: [
      { label: '1-pack', quantity: 1 },
      { label: '2-pack', quantity: 2 },
      { label: '5-pack', quantity: 5 },
    ],
  },
  {
    key: 'preroll-weight',
    label: 'Preroll (weight)',
    rows: [
      { label: '0.5g', weight: { value: 0.5, unit: 'g' } },
      { label: '0.75g', weight: { value: 0.75, unit: 'g' } },
      { label: '1g', weight: { value: 1, unit: 'g' } },
      { label: '1.5g', weight: { value: 1.5, unit: 'g' } },
    ],
  },
  {
    key: 'concentrate',
    label: 'Concentrate',
    rows: [
      { label: '0.5g', weight: { value: 0.5, unit: 'g' } },
      { label: '1g', weight: { value: 1, unit: 'g' } },
    ],
  },
  {
    key: 'edible',
    label: 'Edible (free-form)',
    rows: [{ label: '' }],
  },
  {
    key: 'vape',
    label: 'Vape',
    rows: [
      { label: '0.5g cart', weight: { value: 0.5, unit: 'g' } },
      { label: '1g cart', weight: { value: 1, unit: 'g' } },
      { label: 'Disposable 1g', weight: { value: 1, unit: 'g' } },
    ],
  },
  {
    key: 'drink',
    label: 'Drink',
    rows: [
      { label: 'Single Can', quantity: 1 },
      { label: '2-pack', quantity: 2 },
    ],
  },
  {
    key: 'single',
    label: 'Single / 1-pack',
    rows: [{ label: '1-pack', quantity: 1 }],
  },
  {
    key: 'custom',
    label: 'Custom',
    rows: [{ label: '' }],
  },
];

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

// ── Main component ─────────────────────────────────────────────────────────

interface VariantEditorProps {
  /** Initial variants (from existing product), or empty for new products */
  initialVariants?: ProductVariant[];
}

export function VariantEditor({ initialVariants = [] }: VariantEditorProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function applyTemplate(templateKey: string) {
    const tpl = TEMPLATES.find(t => t.key === templateKey);
    if (!tpl) return;
    setVariants(buildRows(tpl.rows));
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
        Define purchasable sizes or configurations. Pricing is set per-location
        in Inventory.
      </span>

      <div className="variant-editor-template-row">
        <label>
          Template
          <select
            onChange={e => applyTemplate(e.target.value)}
            defaultValue=""
            aria-label="Select a variant template"
          >
            <option value="" disabled>
              Pre-fill from template&hellip;
            </option>
            {TEMPLATES.map(t => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <span className="admin-hint">
          Selecting a template replaces existing rows.
        </span>
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

      {/* Hidden input carries the serialized variants JSON to the server action */}
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />
    </fieldset>
  );
}
