import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariantEditor } from '@/components/admin/VariantEditor';
import type { VariantGroup } from '@/types/product';

function buildGroup(): VariantGroup {
  return {
    groupId: 'size',
    label: 'Size',
    combinable: false,
    options: [
      { optionId: 'small', label: 'Small' },
      { optionId: 'medium', label: 'Medium' },
      { optionId: 'large', label: 'Large' },
    ],
  };
}

function expandFirstGroup() {
  fireEvent.click(screen.getByLabelText('Expand group 1'));
}

describe('VariantEditor DnD (#223)', () => {
  it('exposes a dnd-kit drag handle for each option row (replacing native HTML5 draggable)', () => {
    render(<VariantEditor initialGroups={[buildGroup()]} />);
    expandFirstGroup();
    expect(screen.getByLabelText('Drag option 1 to reorder')).toBeDefined();
    expect(screen.getByLabelText('Drag option 2 to reorder')).toBeDefined();
    expect(screen.getByLabelText('Drag option 3 to reorder')).toBeDefined();
  });

  it('persists the variantGroups payload as a hidden input (reorder result is form-submittable)', () => {
    const { container } = render(
      <VariantEditor initialGroups={[buildGroup()]} />
    );
    const hidden = container.querySelector(
      'input[type="hidden"][name="variantGroups"]'
    );
    expect(hidden).not.toBeNull();
    const parsed = JSON.parse(
      (hidden as HTMLInputElement).value
    ) as VariantGroup[];
    expect(parsed[0].options.map(o => o.optionId)).toEqual([
      'small',
      'medium',
      'large',
    ]);
  });
});
