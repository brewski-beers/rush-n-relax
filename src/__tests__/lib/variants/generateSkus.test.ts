import { describe, expect, it } from 'vitest';
import { generateSkus } from '@/lib/variants/generateSkus';
import type { VariantGroup } from '@/types/product';

describe('generateSkus', () => {
  describe('given an empty group array', () => {
    it('returns an empty array without throwing', () => {
      expect(generateSkus([])).toEqual([]);
    });
  });

  describe('given a single standalone group with 3 options', () => {
    it('returns 3 individual variants, each with the option label', () => {
      const groups: VariantGroup[] = [
        {
          groupId: 'flower-weight',
          label: 'Weight',
          combinable: false,
          options: [
            { optionId: 'o1', label: '1g' },
            { optionId: 'o2', label: '3.5g' },
            { optionId: 'o3', label: '7g' },
          ],
        },
      ];

      const result = generateSkus(groups);

      expect(result).toHaveLength(3);
      expect(result.map(v => v.label)).toEqual(['1g', '3.5g', '7g']);
    });

    it('uses optionId as variantId for each standalone option', () => {
      const groups: VariantGroup[] = [
        {
          groupId: 'flower-weight',
          label: 'Weight',
          combinable: false,
          options: [{ optionId: 'opt-1g', label: '1g' }],
        },
      ];

      const result = generateSkus(groups);

      expect(result[0].variantId).toBe('opt-1g');
    });
  });

  describe('given two combinable groups (2 options each)', () => {
    it('returns 4 cartesian-product variants with pipe-joined labels', () => {
      const groups: VariantGroup[] = [
        {
          groupId: 'size',
          label: 'Size',
          combinable: true,
          options: [
            { optionId: 'small', label: 'Small' },
            { optionId: 'large', label: 'Large' },
          ],
        },
        {
          groupId: 'dose',
          label: 'Dose',
          combinable: true,
          options: [
            { optionId: '5mg', label: '5mg' },
            { optionId: '10mg', label: '10mg' },
          ],
        },
      ];

      const result = generateSkus(groups);

      expect(result).toHaveLength(4);
      expect(result.map(v => v.label)).toEqual([
        'Small | 5mg',
        'Small | 10mg',
        'Large | 5mg',
        'Large | 10mg',
      ]);
    });

    it('generates variantIds by joining optionIds with a dash', () => {
      const groups: VariantGroup[] = [
        {
          groupId: 'size',
          label: 'Size',
          combinable: true,
          options: [
            { optionId: 'small', label: 'Small' },
            { optionId: 'large', label: 'Large' },
          ],
        },
        {
          groupId: 'dose',
          label: 'Dose',
          combinable: true,
          options: [
            { optionId: '5mg', label: '5mg' },
            { optionId: '10mg', label: '10mg' },
          ],
        },
      ];

      const ids = generateSkus(groups).map(v => v.variantId);

      expect(ids).toEqual([
        'small-5mg',
        'small-10mg',
        'large-5mg',
        'large-10mg',
      ]);
    });
  });

  describe('given one standalone and one combinable group', () => {
    it('standalone options become individual SKUs; combinable group expands separately', () => {
      const groups: VariantGroup[] = [
        {
          groupId: 'pack',
          label: 'Pack',
          combinable: false,
          options: [
            { optionId: 'single', label: 'Single' },
            { optionId: 'bundle', label: 'Bundle' },
          ],
        },
        {
          groupId: 'dose',
          label: 'Dose',
          combinable: true,
          options: [
            { optionId: '5mg', label: '5mg' },
            { optionId: '10mg', label: '10mg' },
          ],
        },
      ];

      const result = generateSkus(groups);

      expect(result).toHaveLength(4);
      const labels = result.map(v => v.label);
      expect(labels).toContain('Single');
      expect(labels).toContain('Bundle');
      expect(labels).toContain('5mg');
      expect(labels).toContain('10mg');
    });
  });

  describe('given a group with zero options', () => {
    it('contributes no variants and does not throw', () => {
      const groups: VariantGroup[] = [
        { groupId: 'empty', label: 'Empty', combinable: false, options: [] },
        {
          groupId: 'size',
          label: 'Size',
          combinable: false,
          options: [{ optionId: 'o1', label: '1g' }],
        },
      ];

      const result = generateSkus(groups);

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('1g');
    });

    it('returns empty array when all groups have zero options', () => {
      const groups: VariantGroup[] = [
        { groupId: 'a', label: 'A', combinable: false, options: [] },
        { groupId: 'b', label: 'B', combinable: true, options: [] },
      ];

      expect(generateSkus(groups)).toEqual([]);
    });
  });
});
