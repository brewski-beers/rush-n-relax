import { describe, it, expect } from 'vitest';
import {
  getVariantsForCategory,
  getSizeLabelForCategory,
} from '@/constants/product-variants';

describe('getVariantsForCategory', () => {
  it('returns weight-based variants for flower', () => {
    const variants = getVariantsForCategory('flower');
    const labels = variants.map(v => v.label);
    expect(labels).toContain('1/8 oz');
    expect(labels).toContain('1/4 oz');
    expect(labels).toContain('Preroll');
  });

  it('returns quantity-based variants for edibles', () => {
    const variants = getVariantsForCategory('edibles');
    const labels = variants.map(v => v.label);
    expect(labels).toContain('1pc');
    expect(labels).toContain('5-pack');
    expect(labels).toContain('10-pack');
  });

  it('returns unit-based variants for drinks', () => {
    const variants = getVariantsForCategory('drinks');
    const labels = variants.map(v => v.label);
    expect(labels).toContain('Single Can');
    expect(labels).toContain('2-pack');
  });

  it('returns weight-based variants for concentrates', () => {
    const variants = getVariantsForCategory('concentrates');
    const labels = variants.map(v => v.label);
    expect(labels).toContain('0.5g');
    expect(labels).toContain('1g');
  });

  it('returns unit-based variants for vapes', () => {
    const variants = getVariantsForCategory('vapes');
    const labels = variants.map(v => v.label);
    expect(labels).toContain('Single Cart');
    expect(labels).toContain('2-pack');
  });

  it('falls back to flower variants for unknown category', () => {
    const unknown = getVariantsForCategory('unknown-category');
    const flower = getVariantsForCategory('flower');
    expect(unknown).toEqual(flower);
  });

  it('returns non-empty arrays for all known categories', () => {
    for (const cat of [
      'flower',
      'edibles',
      'drinks',
      'concentrates',
      'vapes',
    ]) {
      expect(getVariantsForCategory(cat).length).toBeGreaterThan(0);
    }
  });
});

describe('getSizeLabelForCategory', () => {
  it('returns Select Weight for flower', () => {
    expect(getSizeLabelForCategory('flower')).toBe('Select Weight');
  });

  it('returns Select Quantity for edibles', () => {
    expect(getSizeLabelForCategory('edibles')).toBe('Select Quantity');
  });

  it('returns Select Quantity for drinks', () => {
    expect(getSizeLabelForCategory('drinks')).toBe('Select Quantity');
  });

  it('returns Select Weight for concentrates', () => {
    expect(getSizeLabelForCategory('concentrates')).toBe('Select Weight');
  });

  it('returns Select Quantity for vapes', () => {
    expect(getSizeLabelForCategory('vapes')).toBe('Select Quantity');
  });

  it('falls back to Select Size for unknown category', () => {
    expect(getSizeLabelForCategory('unknown')).toBe('Select Size');
  });
});
