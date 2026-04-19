'use client';

import { useState, useId } from 'react';
import { useRouter } from 'next/navigation';
import type { VariantTemplate } from '@/types/variant-template';
import type { VariantOption } from '@/types/product';

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface VariantGroupFormProps {
  initial?: VariantTemplate;
  onSave: (
    key: string,
    label: string,
    group: {
      groupId: string;
      label: string;
      combinable: boolean;
      options: VariantOption[];
    }
  ) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
}

export function VariantGroupForm({ initial, onSave }: VariantGroupFormProps) {
  const router = useRouter();
  const id = useId();

  const [label, setLabel] = useState(initial?.label ?? '');
  const [combinable, setCombinable] = useState(
    initial?.group.combinable ?? false
  );
  const [options, setOptions] = useState<VariantOption[]>(
    initial?.group.options ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = initial?.key ?? slugify(label);
  const groupId = initial?.group.groupId ?? slugify(label);

  function addOption() {
    setOptions(prev => [...prev, { optionId: '', label: '' }]);
  }

  function updateOptionLabel(idx: number, value: string) {
    setOptions(prev =>
      prev.map((o, i) => {
        if (i !== idx) return o;
        return {
          ...o,
          label: value,
          optionId:
            o.optionId === slugify(o.label) ? slugify(value) : o.optionId,
        };
      })
    );
  }

  function updateOptionId(idx: number, value: string) {
    setOptions(prev =>
      prev.map((o, i) => (i === idx ? { ...o, optionId: value } : o))
    );
  }

  function removeOption(idx: number) {
    setOptions(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave(key, label, {
      groupId,
      label,
      combinable,
      options,
    });
    setSaving(false);
    if (result.ok) {
      router.push('/admin/variant-groups');
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={e => void handleSubmit(e)} className="admin-form">
      <div className="admin-field">
        <label htmlFor={`${id}-label`}>
          Label
          <input
            id={`${id}-label`}
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Flower Weights"
            required
            disabled={saving}
          />
        </label>
        {label && (
          <span className="admin-hint">
            Key: <code>{key || '—'}</code>
          </span>
        )}
      </div>

      <div className="admin-field">
        <label className="variant-editor-combinable-label">
          <input
            type="checkbox"
            checked={combinable}
            onChange={e => setCombinable(e.target.checked)}
            disabled={saving}
          />
          <span>Stack group (combinable)</span>
        </label>
        <span className="admin-hint">
          Stacked groups are cross-multiplied with other stacked groups into
          combined SKUs.
        </span>
      </div>

      <fieldset className="admin-fieldset">
        <legend>Options</legend>
        {options.map((opt, oi) => (
          <div key={oi} className="variant-editor-item">
            <div className="variant-editor-card-fields">
              <label htmlFor={`${id}-opt-${oi}-label`}>
                <span className="admin-hint">Label</span>
                <input
                  id={`${id}-opt-${oi}-label`}
                  type="text"
                  value={opt.label}
                  onChange={e => updateOptionLabel(oi, e.target.value)}
                  placeholder="e.g. Eighth | 3.5g"
                  required
                  disabled={saving}
                />
              </label>
              <label htmlFor={`${id}-opt-${oi}-id`}>
                <span className="admin-hint">Option ID</span>
                <input
                  id={`${id}-opt-${oi}-id`}
                  type="text"
                  value={opt.optionId}
                  onChange={e => updateOptionId(oi, e.target.value)}
                  pattern="[a-z0-9-]+"
                  title="lowercase letters, numbers, and hyphens only"
                  disabled={saving}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => removeOption(oi)}
              aria-label={`Remove option ${oi + 1}`}
              className="variant-editor-delete-btn"
              disabled={saving}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addOption}
          className="admin-add-row-btn"
          disabled={saving}
        >
          + Add option
        </button>
      </fieldset>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-form-actions">
        <button
          type="submit"
          className="admin-btn-primary"
          disabled={saving || !label.trim()}
        >
          {saving ? 'Saving…' : initial ? 'Update Group' : 'Create Group'}
        </button>
        <button
          type="button"
          className="admin-btn-ghost"
          onClick={() => router.push('/admin/variant-groups')}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
