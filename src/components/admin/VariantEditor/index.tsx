'use client';

/**
 * VariantEditor — variant-group configurator for admin product forms.
 *
 * Each group has a label, a stack toggle, and a list of options.
 * Stacked groups are cross-multiplied into flat SKUs on save.
 *
 * Per-group UX:
 *   - Groups with options start collapsed; new (empty) groups start expanded
 *   - Drag the ≡ handle in the group header bar to reorder groups
 *   - "Copy from template" dropdown replaces the group's options with a saved template
 *   - "Save '{name}' as template" appears when the group label doesn't match any template key
 *
 * Top-level template chips add a whole new pre-configured group.
 */

import { useState, useId, useRef } from 'react';
import type { VariantGroup, VariantOption } from '@/types/product';
import type { VariantTemplate as StoredVariantTemplate } from '@/types/variant-template';
import { generateSkus } from '@/lib/variants/generateSkus';
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

// ── OptionRow ─────────────────────────────────────────────────────────────

interface OptionRowProps {
  option: VariantOption;
  index: number;
  total: number;
  isDragOver: boolean;
  groupIndex: number;
  onLabelChange: (groupIdx: number, optIdx: number, value: string) => void;
  onIdChange: (groupIdx: number, optIdx: number, value: string) => void;
  onDelete: (groupIdx: number, optIdx: number) => void;
  onMoveUp: (groupIdx: number, optIdx: number) => void;
  onMoveDown: (groupIdx: number, optIdx: number) => void;
  onDragStart: (groupIdx: number, optIdx: number) => void;
  onDragOver: (e: React.DragEvent, groupIdx: number, optIdx: number) => void;
  onDrop: (groupIdx: number, optIdx: number) => void;
  onDragEnd: () => void;
}

function OptionRow({
  option,
  index,
  total,
  isDragOver,
  groupIndex,
  onLabelChange,
  onIdChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: OptionRowProps) {
  const id = useId();

  function handleLabelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newLabel = e.target.value;
    onLabelChange(groupIndex, index, newLabel);
    if (option.optionId === slugify(option.label)) {
      onIdChange(groupIndex, index, slugify(newLabel));
    }
  }

  return (
    <div
      className={`variant-editor-item${isDragOver ? ' variant-editor-item--drag-over' : ''}`}
      aria-label={`Option ${index + 1}`}
    >
      <div className="variant-editor-move">
        <button
          type="button"
          onClick={() => onMoveUp(groupIndex, index)}
          disabled={index === 0}
          aria-label={`Move option ${index + 1} up`}
          className="variant-editor-move-btn"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(groupIndex, index)}
          disabled={index === total - 1}
          aria-label={`Move option ${index + 1} down`}
          className="variant-editor-move-btn"
        >
          ↓
        </button>
      </div>

      <div
        className="variant-editor-card"
        draggable
        onDragStart={() => onDragStart(groupIndex, index)}
        onDragOver={e => onDragOver(e, groupIndex, index)}
        onDrop={() => onDrop(groupIndex, index)}
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
              value={option.label}
              onChange={handleLabelChange}
              placeholder="e.g. Eighth | 3.5g"
              required
            />
          </label>
          <label htmlFor={`${id}-oid`}>
            <span className="admin-hint">Option ID</span>
            <input
              id={`${id}-oid`}
              type="text"
              value={option.optionId}
              onChange={e => onIdChange(groupIndex, index, e.target.value)}
              pattern="[a-z0-9-]+"
              title="lowercase letters, numbers, and hyphens only"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => onDelete(groupIndex, index)}
          aria-label={`Delete option ${index + 1}`}
          className="variant-editor-delete-btn"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── GroupPanel ────────────────────────────────────────────────────────────

interface GroupPanelProps {
  group: VariantGroup;
  groupIndex: number;
  templates: StoredVariantTemplate[];
  dragOverKey: string | null;
  isExpanded: boolean;
  isDragOver: boolean;
  onToggleExpand: (groupIdx: number) => void;
  onGroupLabelChange: (groupIdx: number, value: string) => void;
  onCombinableChange: (groupIdx: number, value: boolean) => void;
  onDeleteGroup: (groupIdx: number) => void;
  onReplaceOptions: (groupIdx: number, tpl: StoredVariantTemplate) => void;
  onOptionLabelChange: (
    groupIdx: number,
    optIdx: number,
    value: string
  ) => void;
  onOptionIdChange: (groupIdx: number, optIdx: number, value: string) => void;
  onDeleteOption: (groupIdx: number, optIdx: number) => void;
  onMoveOptionUp: (groupIdx: number, optIdx: number) => void;
  onMoveOptionDown: (groupIdx: number, optIdx: number) => void;
  onAddOption: (groupIdx: number) => void;
  onDragStart: (groupIdx: number, optIdx: number) => void;
  onDragOver: (e: React.DragEvent, groupIdx: number, optIdx: number) => void;
  onDrop: (groupIdx: number, optIdx: number) => void;
  onDragEnd: () => void;
  onSaveAsTemplate: (groupIdx: number) => void;
  onGroupDragStart: (groupIdx: number) => void;
  onGroupDragOver: (e: React.DragEvent, groupIdx: number) => void;
  onGroupDrop: (groupIdx: number) => void;
  onGroupDragEnd: () => void;
}

function GroupPanel({
  group,
  groupIndex,
  templates,
  dragOverKey,
  isExpanded,
  isDragOver,
  onToggleExpand,
  onGroupLabelChange,
  onCombinableChange,
  onDeleteGroup,
  onReplaceOptions,
  onOptionLabelChange,
  onOptionIdChange,
  onDeleteOption,
  onMoveOptionUp,
  onMoveOptionDown,
  onAddOption,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSaveAsTemplate,
  onGroupDragStart,
  onGroupDragOver,
  onGroupDrop,
  onGroupDragEnd,
}: GroupPanelProps) {
  const checkId = useId();
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);

  const groupKey = slugify(group.label);
  const hasTemplateMatch = templates.some(t => t.key === groupKey);
  const showSaveButton = group.options.length > 0 && !hasTemplateMatch;

  const optionCount = group.options.length;
  const optionSummary =
    optionCount === 1 ? '1 option' : `${optionCount} options`;

  return (
    <div
      className={`variant-editor-group${isDragOver ? ' variant-editor-group--drag-over' : ''}`}
      onDragOver={e => onGroupDragOver(e, groupIndex)}
      onDrop={() => onGroupDrop(groupIndex)}
    >
      {/* Collapsible group header bar */}
      <div className="variant-editor-group-bar">
        {/* Drag handle — only this triggers group drag */}
        <div
          className="variant-editor-group-drag-handle"
          aria-hidden="true"
          draggable
          onDragStart={() => onGroupDragStart(groupIndex)}
          onDragEnd={onGroupDragEnd}
          title="Drag to reorder group"
        >
          ≡
        </div>

        {/* Collapsed summary (label + option count) */}
        <span className="variant-editor-group-summary">
          <span className="variant-editor-group-name">
            {group.label || <em>Unnamed group</em>}
          </span>
          {optionCount > 0 && (
            <span className="admin-hint variant-editor-group-count">
              · {optionSummary}
            </span>
          )}
        </span>

        {/* Expand / collapse toggle */}
        <button
          type="button"
          className="variant-editor-group-toggle"
          onClick={() => onToggleExpand(groupIndex)}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? `Collapse group ${groupIndex + 1}`
              : `Expand group ${groupIndex + 1}`
          }
        >
          {isExpanded ? '▲' : '▼'}
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDeleteGroup(groupIndex)}
          aria-label={`Delete group ${groupIndex + 1}`}
          className="variant-editor-delete-btn"
        >
          ✕
        </button>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="variant-editor-group-body">
          {/* Group label input */}
          <input
            type="text"
            className="variant-editor-group-label-input"
            value={group.label}
            onChange={e => onGroupLabelChange(groupIndex, e.target.value)}
            placeholder="Group label (e.g. Flavor)"
            aria-label={`Group ${groupIndex + 1} label`}
          />

          {/* Options header row */}
          <div className="variant-editor-options-header">
            <span className="admin-hint">Options</span>
            {templates.length > 0 && (
              <div className="variant-editor-copy-menu">
                <button
                  type="button"
                  className="admin-btn-ghost variant-editor-copy-btn"
                  onClick={() => setCopyMenuOpen(o => !o)}
                  aria-expanded={copyMenuOpen}
                >
                  Copy from template ▾
                </button>
                {copyMenuOpen && (
                  <div className="variant-editor-copy-dropdown">
                    {templates.map(tpl => (
                      <button
                        key={tpl.id}
                        type="button"
                        className="variant-editor-copy-option"
                        onClick={() => {
                          onReplaceOptions(groupIndex, tpl);
                          setCopyMenuOpen(false);
                        }}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Option rows */}
          <div className="variant-editor-list">
            {group.options.map((opt, oi) => (
              <OptionRow
                key={oi}
                option={opt}
                index={oi}
                total={group.options.length}
                isDragOver={dragOverKey === `${groupIndex}-${oi}`}
                groupIndex={groupIndex}
                onLabelChange={onOptionLabelChange}
                onIdChange={onOptionIdChange}
                onDelete={onDeleteOption}
                onMoveUp={onMoveOptionUp}
                onMoveDown={onMoveOptionDown}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
              />
            ))}
          </div>

          <div className="variant-editor-group-footer">
            <button
              type="button"
              onClick={() => onAddOption(groupIndex)}
              className="admin-add-row-btn"
            >
              + Add option
            </button>
            {showSaveButton && group.label && (
              <button
                type="button"
                className="variant-editor-save-tpl-btn"
                onClick={() => onSaveAsTemplate(groupIndex)}
              >
                Save &ldquo;{group.label}&rdquo; as template
              </button>
            )}
          </div>

          {/* Stack group checkbox */}
          <label
            htmlFor={`${checkId}-combinable`}
            className="variant-editor-combinable-label"
          >
            <input
              id={`${checkId}-combinable`}
              type="checkbox"
              checked={group.combinable}
              onChange={e => onCombinableChange(groupIndex, e.target.checked)}
            />
            <span>Stack group</span>
          </label>
          <span className="admin-hint variant-editor-stack-hint">
            Stacked groups are cross-multiplied into combined SKUs. Order
            determines selection sequence.
          </span>
        </div>
      )}
    </div>
  );
}

// ── SaveTemplateForm ───────────────────────────────────────────────────────

interface SaveTemplateFormProps {
  group: VariantGroup;
  onSaved: (tpl: StoredVariantTemplate) => void;
  onCancel: () => void;
}

function SaveTemplateForm({ group, onSaved, onCancel }: SaveTemplateFormProps) {
  const [label, setLabel] = useState(group.label);
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
    const result = await saveVariantTemplateAction(key, label, group);
    setSaving(false);
    if (result.ok) {
      const optimistic: StoredVariantTemplate = {
        id: result.id,
        key,
        label,
        group,
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
        <span className="admin-hint">Template name</span>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Flower weights"
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

// ── VariantEditor (main) ───────────────────────────────────────────────────

interface VariantEditorProps {
  initialGroups?: VariantGroup[];
  variantTemplates?: StoredVariantTemplate[];
}

export function VariantEditor({
  initialGroups = [],
  variantTemplates = [],
}: VariantEditorProps) {
  const [groups, setGroups] = useState<VariantGroup[]>(initialGroups);
  const [templates, setTemplates] =
    useState<StoredVariantTemplate[]>(variantTemplates);
  const [savingGroupIdx, setSavingGroupIdx] = useState<number | null>(null);

  // New groups (0 options) start expanded; groups with options start collapsed
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () =>
      new Set(
        initialGroups.filter(g => g.options.length === 0).map(g => g.groupId)
      )
  );

  // Option-level DnD
  const dragKeyRef = useRef<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Group-level DnD
  const dragGroupRef = useRef<number | null>(null);
  const [dragOverGroupIndex, setDragOverGroupIndex] = useState<number | null>(
    null
  );

  // ── Expand/collapse ───────────────────────────────────────────────────────

  function toggleExpand(groupIdx: number) {
    const groupId = groups[groupIdx]?.groupId;
    if (!groupId) return;
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  // ── Template actions ──────────────────────────────────────────────────────

  function addGroupFromTemplate(tpl: StoredVariantTemplate) {
    setGroups(prev => [...prev, { ...tpl.group }]);
    // Template groups have options — start collapsed (don't add to expandedGroups)
  }

  async function handleDeleteTemplate(id: string) {
    const result = await deleteVariantTemplateAction(id);
    if (result.ok) {
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
  }

  // ── Group mutations ───────────────────────────────────────────────────────

  function addGroup() {
    const newGroupId = `group-${Date.now()}`;
    setGroups(prev => [
      ...prev,
      {
        groupId: newGroupId,
        label: '',
        combinable: false,
        options: [],
      },
    ]);
    // New empty groups start expanded
    setExpandedGroups(prev => new Set([...prev, newGroupId]));
  }

  function deleteGroup(groupIdx: number) {
    const groupId = groups[groupIdx]?.groupId;
    setGroups(prev => prev.filter((_, i) => i !== groupIdx));
    if (groupId) {
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  }

  function changeGroupLabel(groupIdx: number, value: string) {
    setGroups(prev =>
      prev.map((g, i) =>
        i === groupIdx
          ? {
              ...g,
              label: value,
              groupId:
                g.groupId === slugify(g.label) ? slugify(value) : g.groupId,
            }
          : g
      )
    );
  }

  function changeCombinableFlag(groupIdx: number, value: boolean) {
    setGroups(prev =>
      prev.map((g, i) => (i === groupIdx ? { ...g, combinable: value } : g))
    );
  }

  function replaceOptionsFromTemplate(
    groupIdx: number,
    tpl: StoredVariantTemplate
  ) {
    setGroups(prev =>
      prev.map((g, i) =>
        i === groupIdx
          ? {
              ...g,
              label: g.label || tpl.label,
              groupId:
                !g.label || g.groupId === slugify(g.label)
                  ? slugify(tpl.label)
                  : g.groupId,
              options: [...tpl.group.options],
            }
          : g
      )
    );
  }

  // ── Option mutations ──────────────────────────────────────────────────────

  function addOption(groupIdx: number) {
    setGroups(prev =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, options: [...g.options, { optionId: '', label: '' }] }
          : g
      )
    );
  }

  function deleteOption(groupIdx: number, optIdx: number) {
    setGroups(prev =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, options: g.options.filter((_, oi) => oi !== optIdx) }
          : g
      )
    );
  }

  function changeOptionLabel(groupIdx: number, optIdx: number, value: string) {
    setGroups(prev =>
      prev.map((g, i) =>
        i === groupIdx
          ? {
              ...g,
              options: g.options.map((o, oi) =>
                oi === optIdx ? { ...o, label: value } : o
              ),
            }
          : g
      )
    );
  }

  function changeOptionId(groupIdx: number, optIdx: number, value: string) {
    setGroups(prev =>
      prev.map((g, i) =>
        i === groupIdx
          ? {
              ...g,
              options: g.options.map((o, oi) =>
                oi === optIdx ? { ...o, optionId: value } : o
              ),
            }
          : g
      )
    );
  }

  function moveOptionUp(groupIdx: number, optIdx: number) {
    if (optIdx === 0) return;
    setGroups(prev =>
      prev.map((g, i) => {
        if (i !== groupIdx) return g;
        const opts = [...g.options];
        [opts[optIdx - 1], opts[optIdx]] = [opts[optIdx], opts[optIdx - 1]];
        return { ...g, options: opts };
      })
    );
  }

  function moveOptionDown(groupIdx: number, optIdx: number) {
    setGroups(prev =>
      prev.map((g, i) => {
        if (i !== groupIdx) return g;
        if (optIdx >= g.options.length - 1) return g;
        const opts = [...g.options];
        [opts[optIdx], opts[optIdx + 1]] = [opts[optIdx + 1], opts[optIdx]];
        return { ...g, options: opts };
      })
    );
  }

  // ── Option drag handlers ──────────────────────────────────────────────────

  function handleDragStart(groupIdx: number, optIdx: number) {
    dragKeyRef.current = `${groupIdx}-${optIdx}`;
  }

  function handleDragOver(
    e: React.DragEvent,
    groupIdx: number,
    optIdx: number
  ) {
    e.preventDefault();
    setDragOverKey(`${groupIdx}-${optIdx}`);
  }

  function handleDrop(groupIdx: number, dropOptIdx: number) {
    const dragKey = dragKeyRef.current;
    if (!dragKey) return;
    const [dragGroupStr, dragOptStr] = dragKey.split('-');
    const dragGroupIdx = Number(dragGroupStr);
    const dragOptIdx = Number(dragOptStr);
    if (dragGroupIdx !== groupIdx || dragOptIdx === dropOptIdx) {
      dragKeyRef.current = null;
      setDragOverKey(null);
      return;
    }
    setGroups(prev =>
      prev.map((g, i) => {
        if (i !== groupIdx) return g;
        const opts = [...g.options];
        const [dragged] = opts.splice(dragOptIdx, 1);
        opts.splice(dropOptIdx, 0, dragged);
        return { ...g, options: opts };
      })
    );
    dragKeyRef.current = null;
    setDragOverKey(null);
  }

  function handleDragEnd() {
    dragKeyRef.current = null;
    setDragOverKey(null);
  }

  // ── Group drag handlers ───────────────────────────────────────────────────

  function handleGroupDragStart(groupIdx: number) {
    dragGroupRef.current = groupIdx;
  }

  function handleGroupDragOver(e: React.DragEvent, groupIdx: number) {
    e.preventDefault();
    if (dragGroupRef.current !== null) {
      setDragOverGroupIndex(groupIdx);
    }
  }

  function handleGroupDrop(dropGroupIdx: number) {
    const dragIdx = dragGroupRef.current;
    if (dragIdx === null || dragIdx === dropGroupIdx) {
      dragGroupRef.current = null;
      setDragOverGroupIndex(null);
      return;
    }
    setGroups(prev => {
      const next = [...prev];
      const [dragged] = next.splice(dragIdx, 1);
      next.splice(dropGroupIdx, 0, dragged);
      return next;
    });
    dragGroupRef.current = null;
    setDragOverGroupIndex(null);
  }

  function handleGroupDragEnd() {
    dragGroupRef.current = null;
    setDragOverGroupIndex(null);
  }

  const previewSkus = generateSkus(groups);

  return (
    <fieldset className="admin-fieldset variant-editor">
      <legend>Variants</legend>
      <span className="admin-hint">
        Define option groups. Stacked groups are cross-multiplied into SKUs.
        Pricing is set per-location in Inventory.
      </span>

      {/* Top-level template chips — adds a whole new pre-configured group */}
      {templates.length > 0 && (
        <div className="variant-editor-template-row">
          <span className="admin-hint">Add group from template:</span>
          <div className="variant-editor-template-chips">
            {templates.map(tpl => (
              <span key={tpl.id} className="tag-chip variant-template-chip">
                <button
                  type="button"
                  className="variant-editor-chip-apply"
                  onClick={() => addGroupFromTemplate(tpl)}
                  title={`Add group: ${tpl.label}`}
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
        </div>
      )}

      {/* Group panels */}
      {groups.map((group, gi) => (
        <GroupPanel
          key={group.groupId}
          group={group}
          groupIndex={gi}
          templates={templates}
          dragOverKey={dragOverKey}
          isExpanded={expandedGroups.has(group.groupId)}
          isDragOver={dragOverGroupIndex === gi}
          onToggleExpand={toggleExpand}
          onGroupLabelChange={changeGroupLabel}
          onCombinableChange={changeCombinableFlag}
          onDeleteGroup={deleteGroup}
          onReplaceOptions={replaceOptionsFromTemplate}
          onOptionLabelChange={changeOptionLabel}
          onOptionIdChange={changeOptionId}
          onDeleteOption={deleteOption}
          onMoveOptionUp={moveOptionUp}
          onMoveOptionDown={moveOptionDown}
          onAddOption={addOption}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onSaveAsTemplate={idx => setSavingGroupIdx(idx)}
          onGroupDragStart={handleGroupDragStart}
          onGroupDragOver={handleGroupDragOver}
          onGroupDrop={handleGroupDrop}
          onGroupDragEnd={handleGroupDragEnd}
        />
      ))}

      <button type="button" onClick={addGroup} className="admin-add-row-btn">
        + Add group
      </button>

      {/* Save-as-template inline form */}
      {savingGroupIdx !== null && groups[savingGroupIdx] !== undefined && (
        <SaveTemplateForm
          group={groups[savingGroupIdx]}
          onSaved={tpl => {
            setTemplates(prev => {
              const idx = prev.findIndex(t => t.key === tpl.key);
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = tpl;
                return next;
              }
              return [...prev, tpl];
            });
            setSavingGroupIdx(null);
          }}
          onCancel={() => setSavingGroupIdx(null)}
        />
      )}

      {/* SKU preview */}
      {previewSkus.length > 0 && (
        <div className="variant-editor-sku-preview">
          <span className="admin-hint">
            Generated SKUs ({previewSkus.length})
          </span>
          <ul className="variant-editor-sku-list">
            {previewSkus.map(sku => (
              <li key={sku.variantId} className="variant-editor-sku-item">
                <code>{sku.variantId}</code>
                <span className="admin-hint"> → &ldquo;{sku.label}&rdquo;</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <input
        type="hidden"
        name="variantGroups"
        value={JSON.stringify(groups)}
      />
    </fieldset>
  );
}
