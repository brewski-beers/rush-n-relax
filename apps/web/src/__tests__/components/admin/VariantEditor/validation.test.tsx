import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariantEditor } from '@/components/admin/VariantEditor';
import type { VariantGroup } from '@/types/product';

function group(
  groupId: string,
  options: { optionId: string; label: string }[]
): VariantGroup {
  return { groupId, label: groupId, combinable: false, options };
}

describe('VariantEditor duplicate validation (#230)', () => {
  describe('Given two variants in the same group with optionId=small', () => {
    it('then save is disabled and the duplicate field shows an error', () => {
      const groups = [
        group('size', [
          { optionId: 'small', label: 'S' },
          { optionId: 'small', label: 'Also S' },
        ]),
      ];
      const { container } = render(<VariantEditor initialGroups={groups} />);
      // Group with options starts collapsed — expand it
      fireEvent.click(screen.getByLabelText('Expand group 1'));

      const errors = screen.getAllByRole('alert');
      const dupOptErrors = errors.filter(e =>
        e.textContent?.includes('Duplicate option ID')
      );
      expect(dupOptErrors.length).toBe(2);

      // Save-gating contract: validity input absent when invalid
      expect(
        container.querySelector('input[name="variantGroups-valid"]')
      ).toBeNull();
      const marker = screen.getByTestId('variant-editor-validity');
      expect(marker.getAttribute('data-variant-editor-valid')).toBe('false');
    });
  });

  describe('Given two groups on the product with the same groupId', () => {
    it('then validity is false (Save gate denied)', () => {
      const groups = [
        group('flavor', [{ optionId: 'mint', label: 'Mint' }]),
        group('flavor', [{ optionId: 'lime', label: 'Lime' }]),
      ];
      const { container } = render(<VariantEditor initialGroups={groups} />);
      expect(
        container.querySelector('input[name="variantGroups-valid"]')
      ).toBeNull();
      const marker = screen.getByTestId('variant-editor-validity');
      expect(marker.getAttribute('data-variant-editor-valid')).toBe('false');
    });
  });

  describe('Given a clean product with no duplicates', () => {
    it('then validity is true and the gate input is present', () => {
      const groups = [
        group('size', [
          { optionId: 'small', label: 'S' },
          { optionId: 'large', label: 'L' },
        ]),
      ];
      const { container } = render(<VariantEditor initialGroups={groups} />);
      expect(
        container.querySelector('input[name="variantGroups-valid"]')
      ).not.toBeNull();
      const marker = screen.getByTestId('variant-editor-validity');
      expect(marker.getAttribute('data-variant-editor-valid')).toBe('true');
    });
  });
});
