'use client';

/**
 * VariantEditor — variant-group configurator for admin product forms.
 *
 * Groups are defined globally at /admin/variant-groups.
 * This component lets you attach/detach those groups to a product
 * and configure stack (combinable) behavior per group.
 *
 * The top section shows "Variant groups on this product" as chips —
 * clicking a chip detaches the group from THIS product only (never
 * deletes the global template).
 *
 * The "Add group" dropdown lists all globally-defined groups that are
 * not already attached, plus a manual "Custom group" option.
 */

import { useState, useId, useRef } from 'react';
import type { VariantGroup, VariantOption } from '@/types/product';
import type { VariantTemplate as StoredVariantTemplate } from '@/types/variant-template';
import { generateSkus } from '@/lib/variants/generateSkus';

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
  dragOverKey: string | null;
  isExpanded: boolean;
  isDragOver: boolean;
  onToggleExpand: (groupIdx: number) => void;
  onGroupLabelChange: (groupIdx: number, value: string) => void;
  onCombinableChange: (groupIdx: number, value: boolean) => void;
  /** Detaches the group from this product only — never deletes the template */
  onDetachGroup: (groupIdx: number) => void;
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
  onGroupDragStart: (groupIdx: number) => void;
  onGroupDragOver: (e: React.DragEvent, groupIdx: number) => void;
  onGroupDrop: (groupIdx: number) => void;
  onGroupDragEnd: () => void;
}

function GroupPanel({
  group,
  groupIndex,
  dragOverKey,
  isExpanded,
  isDragOver,
  onToggleExpand,
  onGroupLabelChange,
  onCombinableChange,
  onDetachGroup,
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
  onGroupDragStart,
  onGroupDragOver,
  onGroupDrop,
  onGroupDragEnd,
}: GroupPanelProps) {
  const checkId = useId();

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

        {/* Detach — removes from product only, never deletes global template */}
        <button
          type="button"
          onClick={() => onDetachGroup(groupIndex)}
          aria-label={`Remove group ${groupIndex + 1} from this product`}
          className="variant-editor-delete-btn"
          title="Remove from this product (does not delete the variant group template)"
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

  // New groups (0 options) start expanded; groups with options start collapsed
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () =>
      new Set(
        initialGroups.filter(g => g.options.length === 0).map(g => g.groupId)
      )
  );

  // Dropdown open state for "Add from global group"
  const [addMenuOpen, setAddMenuOpen] = useState(false);

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

  // ── Attach / detach ───────────────────────────────────────────────────────

  /** Attach a global variant template to this product as a new group. */
  function attachGroupFromTemplate(tpl: StoredVariantTemplate) {
    setGroups(prev => [...prev, { ...tpl.group }]);
    setAddMenuOpen(false);
    // Template groups have options — start collapsed
  }

  /** Add a custom (blank) group. */
  function addCustomGroup() {
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
    setExpandedGroups(prev => new Set([...prev, newGroupId]));
    setAddMenuOpen(false);
  }

  /**
   * Detach a group from this product.
   * This is a product-local operation — the global template is NOT deleted.
   */
  function detachGroup(groupIdx: number) {
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

  // ── Group mutations ───────────────────────────────────────────────────────

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

  // Groups not yet attached to this product
  const attachedGroupIds = new Set(groups.map(g => g.groupId));
  const availableTemplates = variantTemplates.filter(
    tpl => !attachedGroupIds.has(tpl.group.groupId)
  );

  return (
    <fieldset className="admin-fieldset variant-editor">
      <legend>Variants</legend>
      <span className="admin-hint">
        Define option groups. Stacked groups are cross-multiplied into SKUs.
        Pricing is set per-location in Inventory.
      </span>

      {/* Attached groups summary */}
      {groups.length > 0 && (
        <div className="variant-editor-attached-row">
          <span className="admin-hint">Variant groups on this product:</span>
          <div className="variant-editor-template-chips">
            {groups.map((g, gi) => (
              <span key={g.groupId} className="tag-chip variant-template-chip">
                <span className="variant-editor-chip-label">
                  {g.label || <em>Unnamed</em>}
                </span>
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => detachGroup(gi)}
                  aria-label={`Remove "${g.label || 'unnamed'}" from this product`}
                  title="Remove from this product only — does not delete the variant group"
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
          dragOverKey={dragOverKey}
          isExpanded={expandedGroups.has(group.groupId)}
          isDragOver={dragOverGroupIndex === gi}
          onToggleExpand={toggleExpand}
          onGroupLabelChange={changeGroupLabel}
          onCombinableChange={changeCombinableFlag}
          onDetachGroup={detachGroup}
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
          onGroupDragStart={handleGroupDragStart}
          onGroupDragOver={handleGroupDragOver}
          onGroupDrop={handleGroupDrop}
          onGroupDragEnd={handleGroupDragEnd}
        />
      ))}

      {/* Add group controls */}
      <div className="variant-editor-add-row">
        <div className="variant-editor-add-menu-wrap">
          <button
            type="button"
            className="admin-add-row-btn"
            onClick={() => setAddMenuOpen(o => !o)}
            aria-expanded={addMenuOpen}
          >
            + Add group ▾
          </button>
          {addMenuOpen && (
            <div className="variant-editor-copy-dropdown">
              {availableTemplates.length > 0 && (
                <>
                  <span className="variant-editor-dropdown-section-label admin-hint">
                    From global variant groups
                  </span>
                  {availableTemplates.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      className="variant-editor-copy-option"
                      onClick={() => attachGroupFromTemplate(tpl)}
                    >
                      {tpl.label}
                    </button>
                  ))}
                  <hr className="variant-editor-dropdown-divider" />
                </>
              )}
              <button
                type="button"
                className="variant-editor-copy-option"
                onClick={addCustomGroup}
              >
                Custom group (blank)
              </button>
            </div>
          )}
        </div>
        <a
          href="/admin/variant-groups"
          target="_blank"
          rel="noreferrer"
          className="admin-hint variant-editor-manage-link"
        >
          Manage global variant groups ↗
        </a>
      </div>

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
