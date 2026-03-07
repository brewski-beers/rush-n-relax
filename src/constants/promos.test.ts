import { describe, it, expect } from 'vitest';
import {
  PROMOS,
  getPromoBySlug,
  getPromoByPromoId,
  getPromoSEO,
} from './promos';
import { SITE_URL } from './site';

describe('PROMOS data', () => {
  it('every promo has a unique slug', () => {
    const slugs = PROMOS.map(p => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every promo has a unique promoId', () => {
    const ids = PROMOS.map(p => p.promoId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every promo has required fields populated', () => {
    for (const promo of PROMOS) {
      expect(promo.promoId.length).toBeGreaterThan(0);
      expect(promo.slug.length).toBeGreaterThan(0);
      expect(promo.name.length).toBeGreaterThan(0);
      expect(promo.tagline.length).toBeGreaterThan(0);
      expect(promo.description.length).toBeGreaterThan(0);
      expect(promo.details.length).toBeGreaterThan(0);
      expect(promo.cta.length).toBeGreaterThan(0);
      expect(promo.ctaPath.startsWith('/')).toBe(true);
    }
  });
});

describe('getPromoBySlug', () => {
  it('returns the matching active promo', () => {
    const promo = getPromoBySlug('laser-bong');
    expect(promo).toBeDefined();
    expect(promo?.slug).toBe('laser-bong');
    expect(promo?.active).toBe(true);
  });

  it('returns undefined for an unknown slug', () => {
    expect(getPromoBySlug('does-not-exist')).toBeUndefined();
  });

  it('does not return inactive promos', () => {
    const inactive = PROMOS.find(p => !p.active);
    if (!inactive) return; // no inactive promos currently — test is a no-op
    expect(getPromoBySlug(inactive.slug)).toBeUndefined();
  });
});

describe('getPromoByPromoId', () => {
  it('returns the matching active promo by promoId', () => {
    const promo = getPromoByPromoId('hitoki-laser-bong-2025');
    expect(promo).toBeDefined();
    expect(promo?.promoId).toBe('hitoki-laser-bong-2025');
  });

  it('returns undefined for an unknown promoId', () => {
    expect(getPromoByPromoId('unknown-id')).toBeUndefined();
  });
});

describe('getPromoSEO', () => {
  it('generates correct title, canonical, and og fields', () => {
    const promo = getPromoBySlug('laser-bong')!;
    const seo = getPromoSEO(promo);

    expect(seo.title).toBe(`${promo.name} | Rush N Relax`);
    expect(seo.canonical).toBe(`${SITE_URL}/promo/${promo.slug}`);
    expect(seo.url).toBe(`${SITE_URL}/promo/${promo.slug}`);
    expect(seo.ogTitle).toContain(promo.name);
    expect(seo.ogDescription).toBe(promo.description);
    expect(seo.ogImage).toContain(SITE_URL);
  });

  it('derives keywords from promo name and tagline', () => {
    const promo = getPromoBySlug('laser-bong')!;
    const seo = getPromoSEO(promo);

    expect(seo.keywords).toContain(promo.name);
    expect(seo.keywords).toContain(promo.tagline);
  });

  it('includes location-based keywords when locationSlug is set', () => {
    const promo = getPromoBySlug('laser-bong')!;
    const seo = getPromoSEO(promo);

    expect(seo.keywords).toContain(promo.locationSlug!);
    expect(seo.keywords).toContain(`Rush N Relax ${promo.locationSlug}`);
    expect(seo.keywords).toContain(`${promo.locationSlug} TN dispensary`);
  });

  it('omits location keywords when locationSlug is not set', () => {
    const promo = getPromoBySlug('laser-bong')!;
    const globalPromo = { ...promo, locationSlug: undefined };
    const seo = getPromoSEO(globalPromo);

    expect(seo.keywords).not.toContain('TN dispensary');
    expect(seo.keywords).not.toContain('Rush N Relax seymour');
  });

  it('includes promo-specific keywords from the keywords field', () => {
    const promo = getPromoBySlug('laser-bong')!;
    const seo = getPromoSEO(promo);

    for (const kw of promo.keywords ?? []) {
      expect(seo.keywords).toContain(kw);
    }
  });

  it('does not throw when keywords field is absent', () => {
    const promo = getPromoBySlug('laser-bong')!;
    const noKeywordsPromo = { ...promo, keywords: undefined };
    expect(() => getPromoSEO(noKeywordsPromo)).not.toThrow();
  });

  it('never contains prohibited terms in keywords', () => {
    const prohibited = [
      'free weed',
      'free cannabis',
      'free marijuana',
      'get high',
      'get stoned',
    ];
    for (const promo of PROMOS) {
      const seo = getPromoSEO(promo);
      for (const term of prohibited) {
        expect(seo.keywords.toLowerCase()).not.toContain(term);
      }
    }
  });
});
