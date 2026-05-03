import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { DragEndEvent } from '@dnd-kit/core';
import { useSortableGrid } from '@/hooks/useSortableGrid';

interface Item {
  id: string;
  label: string;
}

function buildItems(): Item[] {
  return [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];
}

function buildEvent(activeId: string, overId: string): DragEndEvent {
  return {
    active: { id: activeId },
    over: { id: overId },
  } as unknown as DragEndEvent;
}

describe('useSortableGrid', () => {
  it('given a list of items, when user drags item 0 onto position 2, then onReorder is called with the new order', () => {
    const onReorder = vi.fn();
    const items = buildItems();
    const { result } = renderHook(() =>
      useSortableGrid<Item>({ items, getId: i => i.id, onReorder })
    );

    result.current.onDragEnd(buildEvent('a', 'c'));

    expect(onReorder).toHaveBeenCalledTimes(1);
    const firstCall = onReorder.mock.calls[0] as [Item[]];
    expect(firstCall[0].map(i => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('does nothing when drag ends on the same item', () => {
    const onReorder = vi.fn();
    const items = buildItems();
    const { result } = renderHook(() =>
      useSortableGrid<Item>({ items, getId: i => i.id, onReorder })
    );

    result.current.onDragEnd(buildEvent('b', 'b'));

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does nothing when there is no drop target', () => {
    const onReorder = vi.fn();
    const items = buildItems();
    const { result } = renderHook(() =>
      useSortableGrid<Item>({ items, getId: i => i.id, onReorder })
    );

    result.current.onDragEnd({
      active: { id: 'a' },
      over: null,
    } as unknown as DragEndEvent);

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('exposes pre-configured pointer + keyboard sensors', () => {
    const { result } = renderHook(() =>
      useSortableGrid<Item>({
        items: buildItems(),
        getId: i => i.id,
        onReorder: () => undefined,
      })
    );
    expect(result.current.sensors.length).toBeGreaterThanOrEqual(2);
  });
});
