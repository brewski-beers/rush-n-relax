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
 *
 * #230: validates duplicate optionId within a group and duplicate groupId
 *       within the product. The Save button outside this component is
 *       disabled when `name="variantGroups-valid"` (hidden input below) is
 *       absent — Server Actions read it via formData.has().
 */

import { useState, useId, useMemo, useRef } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSortableGrid } from '@/hooks/useSortableGrid';
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

// ── Validation (#230) ──────────────────────────────────────────────────────

interface ValidationErrors {
  /** Map of `${groupIdx}-${optIdx}` → "duplicate" if optionId duplicates within group */
  duplicateOptionIds: Record<string, true>;
  /** Map of groupIdx → true if its groupId duplicates another group on this product */
  duplicateGroupIds: Record<number, true>;
}

function validateGroups(groups: VariantGroup[]): ValidationErrors {
  const duplicateOptionIds: Record<string, true> = {};
  groups.forEach((group, gi) => {
    const seen = new Map<string, number>();
    group.options.forEach((opt, oi) => {
      if (!opt.optionId) return;
      const prev = seen.get(opt.optionId);
      if (prev !== undefined) {
        duplicateOptionIds[`${gi}-${oi}`] = true;
        duplicateOptionIds[`${gi}-${prev}`] = true;
      } else {
        seen.set(opt.optionId, oi);
      }
    });
  });

  const duplicateGroupIds: Record<number, true> = {};
  const groupSeen = new Map<string, number>();
  groups.forEach((g, gi) => {
    if (!g.groupId) return;
    const prev = groupSeen.get(g.groupId);
    if (prev !== undefined) {
      duplicateGroupIds[gi] = true;
      duplicateGroupIds[prev] = true;
    } else {
      groupSeen.set(g.groupId, gi);
    }
  });

  return { duplicateOptionIds, duplicateGroupIds };
}

function hasErrors(errors: ValidationErrors): boolean {
  return (
    Object.keys(errors.duplicateOptionIds).length > 0 ||
    Object.keys(errors.duplicateGroupIds).length > 0
  );
}

// ── OptionRow (sortable via dnd-kit, #223) ─────────────────────────────────

interface OptionRowProps {
  option: VariantOption;
  /** Composite dnd-kit id: `${groupId}::${oi}` — stable across renders even with duplicate optionIds */
  sortableId: string;
  index: number;
  total: number;
  groupIndex: number;
  duplicateOptionIdError: boolean;
  onLabelChange: (groupIdx: number, optIdx: number, value: string) => void;
  onIdChange: (groupIdx: number, optIdx: number, value: string) => void;
  onDelete: (groupIdx: number, optIdx: number) => void;
  onMoveUp: (groupIdx: number, optIdx: number) => void;
  onMoveDown: (groupIdx: number, optIdx: number) => void;
}

function OptionRow({
  option,
  sortableId,
  index,
  total,
  groupIndex,
  duplicateOptionIdError,
  onLabelChange,
  onIdChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: OptionRowProps) {
  const id = useId();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  function handleLabelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newLabel = e.target.value;
    onLabelChange(groupIndex, index, newLabel);
    if (option.optionId === slugify(option.label)) {
      onIdChange(groupIndex, index, slugify(newLabel));
    }
  }

  return (
    <div
      ref={setNodeRef}
      // eslint-disable-next-line react/forbid-dom-props -- @dnd-kit requires inline transform/transition for drag animation
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`variant-editor-item${isDragging ? ' variant-editor-item--drag-over' : ''}`}
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

      <div className="variant-editor-card">
        <button
          type="button"
          className="variant-editor-card-drag-handle"
          aria-label={`Drag option ${index + 1} to reorder`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
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
              aria-invalid={duplicateOptionIdError || undefined}
              aria-describedby={
                duplicateOptionIdError ? `${id}-oid-error` : undefined
              }
            />
            {duplicateOptionIdError && (
              <span
                id={`${id}-oid-error`}
                role="alert"
                className="variant-editor-error"
              >
                Duplicate option ID in this group
              </span>
            )}
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
  isExpanded: boolean;
  isDragOver: boolean;
  duplicateGroupId: boolean;
  duplicateOptionIds: Record<string, true>;
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
  onReorderOptions: (groupIdx: number, oldIdx: number, newIdx: number) => void;
  onGroupDragStart: (groupIdx: number) => void;
  onGroupDragOver: (e: React.DragEvent, groupIdx: number) => void;
  onGroupDrop: (groupIdx: number) => void;
  onGroupDragEnd: () => void;
}

function GroupPanel({
  group,
  groupIndex,
  isExpanded,
  isDragOver,
  duplicateGroupId,
  duplicateOptionIds,
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
  onReorderOptions,
  onGroupDragStart,
  onGroupDragOver,
  onGroupDrop,
  onGroupDragEnd,
}: GroupPanelProps) {
  const checkId = useId();

  const optionCount = group.options.length;
  const optionSummary =
    optionCount === 1 ? '1 option' : `${optionCount} options`;

  // Composite stable IDs — index-based suffix keeps each row uniquely
  // identifiable even when optionId values collide (the very bug #230 catches).
  const sortableItems = group.options.map((_, oi) => ({
    id: `${group.groupId}::${oi}`,
  }));

  const { sensors, onDragEnd } = useSortableGrid({
    items: sortableItems,
    getId: i => i.id,
    onReorder: next => {
      // Translate next ordering of ids back into oldIdx → newIdx pair.
      // Exactly one item moved; find the index that changed.
      const before = sortableItems.map(i => i.id);
      const after = next.map(i => i.id);
      for (let i = 0; i < before.length; i++) {
        if (before[i] !== after[i]) {
          const movedId = after[i];
          const oldIdx = before.indexOf(movedId);
          onReorderOptions(groupIndex, oldIdx, i);
          return;
        }
      }
    },
  });

  return (
    <div
      className={`variant-editor-group${isDragOver ? ' variant-editor-group--drag-over' : ''}${duplicateGroupId ? ' variant-editor-group--error' : ''}`}
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
            aria-invalid={duplicateGroupId || undefined}
          />
          {duplicateGroupId && (
            <span role="alert" className="variant-editor-error">
              Duplicate group ID on this product
            </span>
          )}

          {/* Options header row */}
          <div className="variant-editor-options-header">
            <span className="admin-hint">Options</span>
          </div>

          {/* Option rows — sortable via dnd-kit (#223) */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={sortableItems.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="variant-editor-list">
                {group.options.map((opt, oi) => (
                  <OptionRow
                    key={`${group.groupId}::${oi}`}
                    option={opt}
                    sortableId={`${group.groupId}::${oi}`}
                    index={oi}
                    total={group.options.length}
                    groupIndex={groupIndex}
                    duplicateOptionIdError={
                      duplicateOptionIds[`${groupIndex}-${oi}`] === true
                    }
                    onLabelChange={onOptionLabelChange}
                    onIdChange={onOptionIdChange}
                    onDelete={onDeleteOption}
                    onMoveUp={onMoveOptionUp}
                    onMoveDown={onMoveOptionDown}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

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

  // Group-level DnD (still uses native HTML5 — out of scope for #223)
  const dragGroupRef = useRef<number | null>(null);
  const [dragOverGroupIndex, setDragOverGroupIndex] = useState<number | null>(
    null
  );

  // ── Validation (#230) ─────────────────────────────────────────────────────
  const errors = useMemo(() => validateGroups(groups), [groups]);
  const isValid = !hasErrors(errors);

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

  function reorderOptions(groupIdx: number, oldIdx: number, newIdx: number) {
    setGroups(prev =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, options: arrayMove(g.options, oldIdx, newIdx) }
          : g
      )
    );
  }

  // ── Group drag handlers (HTML5 native — out of scope for #223) ────────────

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
              <span
                key={`${g.groupId}-${gi}`}
                className="tag-chip variant-template-chip"
              >
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
          key={`${group.groupId}-${gi}`}
          group={group}
          groupIndex={gi}
          isExpanded={expandedGroups.has(group.groupId)}
          isDragOver={dragOverGroupIndex === gi}
          duplicateGroupId={errors.duplicateGroupIds[gi] === true}
          duplicateOptionIds={errors.duplicateOptionIds}
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
          onReorderOptions={reorderOptions}
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
                      type="button"
                      key={tpl.id}
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
      {/*
        #230: Server Actions inspect formData for `variantGroups-valid`. When
        validation fails this hidden input is omitted; consumers can also gate
        their submit button via the matching `data-variant-editor-valid`
        attribute exposed below.
      */}
      {isValid && (
        <input type="hidden" name="variantGroups-valid" value="true" />
      )}
      <span
        data-testid="variant-editor-validity"
        data-variant-editor-valid={isValid ? 'true' : 'false'}
        hidden
      />
    </fieldset>
  );
}
