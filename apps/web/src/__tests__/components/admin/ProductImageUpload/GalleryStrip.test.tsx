import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { GalleryStrip } from '@/components/admin/ProductImageUpload/GalleryStrip';

describe('GalleryStrip (#223)', () => {
  it('renders 5 slots and exposes drag handles for non-empty slots', () => {
    const { getAllByLabelText } = render(
      <GalleryStrip
        srcs={['a.jpg', 'b.jpg', null, null, null]}
        paths={['a.jpg', 'b.jpg', null, null, null]}
        uploadingSlots={new Set()}
        errors={{}}
        disabled={false}
        onFile={() => undefined}
        onRemove={() => undefined}
        onReorder={() => undefined}
      />
    );

    // Two filled slots → two drag handles
    expect(getAllByLabelText('Drag to reorder').length).toBe(2);
  });

  it('does not throw when re-rendering with reordered paths (callback wiring intact)', () => {
    const onReorder = vi.fn();
    const { rerender } = render(
      <GalleryStrip
        srcs={['a.jpg', 'b.jpg', null, null, null]}
        paths={['a.jpg', 'b.jpg', null, null, null]}
        uploadingSlots={new Set()}
        errors={{}}
        disabled={false}
        onFile={() => undefined}
        onRemove={() => undefined}
        onReorder={onReorder}
      />
    );
    rerender(
      <GalleryStrip
        srcs={['b.jpg', 'a.jpg', null, null, null]}
        paths={['b.jpg', 'a.jpg', null, null, null]}
        uploadingSlots={new Set()}
        errors={{}}
        disabled={false}
        onFile={() => undefined}
        onRemove={() => undefined}
        onReorder={onReorder}
      />
    );
    expect(onReorder).not.toHaveBeenCalled(); // no user interaction triggered
  });
});
