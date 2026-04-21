'use client';

/**
 * CategoriesTable — client component for the admin categories list.
 * Handles drag-to-reorder rows; persists order via reorderCategoriesAction.
 * Optimistic update: row positions change immediately, server action fires async.
 * On failure, reverts to previous state.
 */

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { toggleCategoryStatus, reorderCategoriesAction } from './actions';
import type { ProductCategoryConfig } from '@/types';

interface CategoriesTableProps {
  initialCategories: ProductCategoryConfig[];
}

export function CategoriesTable({ initialCategories }: CategoriesTableProps) {
  const [categories, setCategories] =
    useState<ProductCategoryConfig[]>(initialCategories);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const dragRowRef = useRef<number | null>(null);
  const [draggingRow, setDraggingRow] = useState<number | null>(null);
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);

  // ── DnD handlers ───────────────────────────────────────────────────────

  function handleDragStart(index: number) {
    dragRowRef.current = index;
    setDraggingRow(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverRow(index);
  }

  function handleDrop(dropIndex: number) {
    const dragIndex = dragRowRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      dragRowRef.current = null;
      setDraggingRow(null);
      setDragOverRow(null);
      return;
    }

    // Snapshot for potential revert
    const previous = categories;

    // Optimistic reorder
    const reordered = [...categories];
    const [dragged] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, dragged);
    const withOrder = reordered.map((cat, i) => ({ ...cat, order: i + 1 }));

    setCategories(withOrder);
    dragRowRef.current = null;
    setDraggingRow(null);
    setDragOverRow(null);

    const orderedSlugs = withOrder.map(c => c.slug);
    setReorderError(null);
    reorderCategoriesAction(orderedSlugs).catch(() => {
      setCategories(previous);
      setReorderError('Failed to save new order. Please try again.');
    });
  }

  function handleDragEnd() {
    dragRowRef.current = null;
    setDraggingRow(null);
    setDragOverRow(null);
  }

  return (
    <>
      {reorderError && <p className="admin-error">{reorderError}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th
                aria-label="Drag to reorder"
                className="admin-table-drag-col"
              />
              <th>Slug</th>
              <th>Label</th>
              <th>Order</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, index) => (
              <tr
                key={cat.slug}
                className={[
                  draggingRow === index ? 'admin-table-row--dragging' : '',
                  dragOverRow === index ? 'admin-table-row--drag-over' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onDragOver={e => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
              >
                <td>
                  <div
                    className="admin-table-drag-handle"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnd={handleDragEnd}
                    title="Drag to reorder"
                    aria-label={`Drag to reorder ${cat.label}`}
                  >
                    ≡
                  </div>
                </td>
                <td>{cat.slug}</td>
                <td>{cat.label}</td>
                <td>{cat.order}</td>
                <td>
                  {cat.description.length > 50
                    ? `${cat.description.slice(0, 50)}…`
                    : cat.description}
                </td>
                <td>
                  <span
                    className={
                      cat.isActive
                        ? 'admin-badge-active'
                        : 'admin-badge-inactive'
                    }
                  >
                    {cat.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="admin-actions">
                  <Link href={`/admin/categories/${cat.slug}/edit`}>Edit</Link>
                  <ConfirmButton
                    action={toggleCategoryStatus.bind(
                      null,
                      cat.slug,
                      cat.isActive
                    )}
                    message={
                      cat.isActive
                        ? `Deactivate "${cat.label}"? It will be hidden from the storefront.`
                        : `Activate "${cat.label}"?`
                    }
                  >
                    {cat.isActive ? 'Deactivate' : 'Activate'}
                  </ConfirmButton>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={7} className="admin-empty">
                  No categories found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
