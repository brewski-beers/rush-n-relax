import { describe, it, test, expect } from 'vitest';
import { checkRequiredDisclaimers } from '@/lib/compliance/disclaimer-checker';

describe('checkRequiredDisclaimers', () => {
  describe('product context', () => {
    it('returns both missing disclaimers when text is empty', () => {
      const missing = checkRequiredDisclaimers('', 'product');
      expect(missing).toContain('For use by adults 21 years of age or older.');
      expect(missing).toContain('Keep out of reach of children.');
    });

    it('returns no missing disclaimers when both are present', () => {
      const text =
        'Premium flower. For use by adults 21 years of age or older. Keep out of reach of children.';
      expect(checkRequiredDisclaimers(text, 'product')).toHaveLength(0);
    });

    it('returns one missing disclaimer when only age disclaimer is present', () => {
      const text = 'For use by adults 21 years of age or older.';
      const missing = checkRequiredDisclaimers(text, 'product');
      expect(missing).toHaveLength(1);
      expect(missing).toContain('Keep out of reach of children.');
    });

    it('returns one missing disclaimer when only children disclaimer is present', () => {
      const text = 'Keep out of reach of children.';
      const missing = checkRequiredDisclaimers(text, 'product');
      expect(missing).toHaveLength(1);
      expect(missing).toContain('For use by adults 21 years of age or older.');
    });
  });

  describe('non-product contexts', () => {
    const noDisclaimerContexts = [
      'promo',
      'seo-title',
      'seo-description',
      'location',
      'structured-data',
    ] as const;

    test.each(noDisclaimerContexts)(
      'returns empty array for %s context',
      context => {
        const missing = checkRequiredDisclaimers(
          'some text with no disclaimers',
          context
        );
        expect(missing).toHaveLength(0);
      }
    );
  });
});
