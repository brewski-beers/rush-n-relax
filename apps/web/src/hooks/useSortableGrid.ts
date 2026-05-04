'use client';

/**
 * useSortableGrid — shared dnd-kit configuration for admin sortable grids.
 *
 * Centralises sensors + drag-end handler used by DashboardGrid, GalleryStrip,
 * and VariantEditor. Keeps the activation distance, keyboard coordinate
 * getter, and arrayMove logic identical across surfaces — so behaviour stays
 * consistent and a future tweak (e.g. touch sensor) only changes one file.
 *
 * Pure logic — does NOT render <DndContext> / <SortableContext>; the caller
 * still wires those up because each surface uses a different sorting strategy
 * and different item-id type. The hook gives back:
 *
 *   - `sensors`    : pre-configured pointer + keyboard sensors
 *   - `onDragEnd`  : a `DragEndEvent` handler that calls `onReorder` with the
 *                    fresh array (using arrayMove on the `items` you pass in)
 *
 * The handler is identity-stable across renders for the same items+callback
 * via the `items` argument being captured per-call (re-derive in render).
 */
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export interface UseSortableGridOptions<T> {
  /** Current items in display order. */
  items: T[];
  /** Extract the dnd-kit id for a given item. */
  getId: (item: T) => string | number;
  /** Called with the post-move array when the user completes a drag. */
  onReorder: (next: T[]) => void;
  /** Pointer activation distance in px. Defaults to 8. */
  activationDistance?: number;
}

export interface UseSortableGridResult {
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
}

export function useSortableGrid<T>({
  items,
  getId,
  onReorder,
  activationDistance = 8,
}: UseSortableGridOptions<T>): UseSortableGridResult {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: activationDistance },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(item => getId(item) === active.id);
    const newIndex = items.findIndex(item => getId(item) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return { sensors, onDragEnd };
}
