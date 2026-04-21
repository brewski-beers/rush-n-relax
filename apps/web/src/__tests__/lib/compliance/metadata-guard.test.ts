import { describe, it, expect } from 'vitest';
import { validateSeoFields } from '@/lib/compliance/metadata-guard';

describe('validateSeoFields', () => {
  it('returns valid when both fields are clean', () => {
    const result = validateSeoFields({
      title: 'Rush N Relax — Oak Ridge Dispensary',
      description:
        'Premium hemp-derived cannabinoid products in East Tennessee.',
    });
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns invalid when title has tier-1 violation', () => {
    const result = validateSeoFields({
      title: 'Treats Anxiety with Hemp Products',
      description: 'Premium hemp flower.',
    });
    expect(result.valid).toBe(false);
    expect(
      result.violations.some(v => v.tier === 1 && v.context === 'seo-title')
    ).toBe(true);
  });

  it('returns invalid when description has tier-1 violation', () => {
    const result = validateSeoFields({
      title: 'Rush N Relax',
      description: 'Cures all ailments naturally.',
    });
    expect(result.valid).toBe(false);
    expect(
      result.violations.some(
        v => v.tier === 1 && v.context === 'seo-description'
      )
    ).toBe(true);
  });

  it('sets requiresReview when tier-2 violation in title', () => {
    const result = validateSeoFields({
      title: 'Best Stress Relief Hemp Products',
    });
    expect(result.requiresReview).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('works with only title provided', () => {
    const result = validateSeoFields({ title: 'Hemp dispensary TN' });
    expect(result.valid).toBe(true);
  });

  it('works with only description provided', () => {
    const result = validateSeoFields({
      description: 'Premium hemp products in Tennessee.',
    });
    expect(result.valid).toBe(true);
  });

  it('works with empty object (no fields)', () => {
    const result = validateSeoFields({});
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.missingDisclaimers).toHaveLength(0);
  });

  it('aggregates violations from both fields', () => {
    const result = validateSeoFields({
      title: 'Treats pain',
      description: 'Cures anxiety',
    });
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });
});
