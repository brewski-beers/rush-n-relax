import { describe, it, test, expect } from 'vitest';
import { validateContent } from '@/lib/compliance/validator';

// ── Tier 1 — Medical claims ────────────────────────────────────────────────

describe('Tier 1 — medical claims', () => {
  const medicalPhrases = [
    'This product treats anxiety',
    'Our flower cures insomnia',
    'It cured my pain',
    'Helps prevent inflammation',
    'Diagnosis-grade wellness',
    'Heals your body naturally',
    'Medicate with our products',
    'Ask your doctor to prescribe this',
    'FDA-approved hemp products',
    'FDA cleared formula',
    'Clinically proven results',
    'Clinically tested formula',
    'Clinically studied extract',
    'This replaces medication',
    'An alternative to your medication',
  ];

  test.each(medicalPhrases)('blocks: %s', phrase => {
    const result = validateContent(phrase, 'product');
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.tier === 1)).toBe(true);
  });

  const safePhrases = [
    'Our flower is enjoyed by customers',
    'Popular with adults seeking relaxation',
    'Available in multiple formats',
    'Premium hemp-derived cannabinoid products',
    'In-store pickup only — no shipping',
  ];

  test.each(safePhrases)('allows: %s', phrase => {
    const result = validateContent(phrase, 'product');
    expect(result.violations.filter(v => v.tier === 1)).toHaveLength(0);
  });
});

// ── Tier 1 — Delivery / shipping ──────────────────────────────────────────

describe('Tier 1 — delivery/shipping (consumable contexts)', () => {
  const deliveryPhrases = [
    'Same-day delivery available',
    'We deliver to all TN locations',
    'Get deliveries on demand',
    'Ships to your door',
    'Shipping to Tennessee',
    'Mail order available',
    'Postal order service',
    'Available nationwide',
    'Ships across state lines',
    'Online ordering available',
  ];

  test.each(deliveryPhrases)('blocks in product context: %s', phrase => {
    const result = validateContent(phrase, 'product');
    expect(result.valid).toBe(false);
  });

  it('allows in-store pickup language', () => {
    const result = validateContent('In-store pickup only', 'product');
    expect(result.valid).toBe(true);
  });

  it('allows delivery language in structured-data context (non-consumable)', () => {
    // structured-data context skips consumableContextOnly rules
    const result = validateContent('Same-day delivery', 'structured-data');
    const deliveryViolations = result.violations.filter(
      v => v.tier === 1 && v.rule.includes('deliveryShipping')
    );
    expect(deliveryViolations).toHaveLength(0);
  });
});

// ── Tier 1 — Illegal framing ───────────────────────────────────────────────

describe('Tier 1 — illegal framing', () => {
  const illegalPhrases = [
    'Recreational cannabis available',
    'Recreational marijuana dispensary',
    'Medical marijuana products',
    'MMJ card accepted',
    'Schedule I substance',
    'Schedule 1 classification',
    'Federally illegal products',
    'Controlled substance regulations',
  ];

  test.each(illegalPhrases)('blocks: %s', phrase => {
    const result = validateContent(phrase, 'product');
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.rule.includes('illegalFraming'))).toBe(
      true
    );
  });

  it('allows hemp-derived framing', () => {
    const result = validateContent(
      'Hemp-derived cannabinoid products',
      'product'
    );
    expect(result.violations.filter(v => v.tier === 1)).toHaveLength(0);
  });
});

// ── Tier 1 — Minor targeting ───────────────────────────────────────────────

describe('Tier 1 — minor targeting', () => {
  const minorPhrases = [
    'Great for kids',
    'Safe for children',
    'Youth-friendly products',
    'Teen approved',
    'Minors must ask parents',
    'Cartoon-themed packaging',
    'Superhero branding',
    'Anime-style design',
  ];

  test.each(minorPhrases)('blocks: %s', phrase => {
    const result = validateContent(phrase, 'product');
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.rule.includes('minorTargeting'))).toBe(
      true
    );
  });

  it('allows adult-oriented framing', () => {
    const result = validateContent(
      'For use by adults 21 years of age or older.',
      'product'
    );
    expect(result.violations.filter(v => v.tier === 1)).toHaveLength(0);
  });
});

// ── Tier 2 — Health benefit claims ────────────────────────────────────────

describe('Tier 2 — health benefit claims', () => {
  const healthPhrases = [
    'Provides stress relief',
    'Great for pain relief',
    'Anxiety relief formula',
    'Sleep aid formula',
    'Pain management support',
    'Anti-inflammatory properties',
    'Anti-anxiety blend',
    'Therapeutic benefits',
    'Wellness support',
    'Natural remedy for sleep',
    'Boosts immunity',
    'Mental health support',
  ];

  test.each(healthPhrases)('flags for review: %s', phrase => {
    const result = validateContent(phrase, 'product');
    expect(result.requiresReview).toBe(true);
    expect(result.violations.some(v => v.tier === 2)).toBe(true);
  });

  it('does not set valid=false for tier-2-only violations', () => {
    const result = validateContent(
      'Great for relaxation and wellness',
      'product'
    );
    // tier-2 only — still valid (can go to review queue)
    expect(result.valid).toBe(true);
    expect(result.requiresReview).toBe(true);
  });
});

// ── Tier 2 — Unverifiable claims ──────────────────────────────────────────

describe('Tier 2 — unverifiable claims', () => {
  const unverifiablePhrases = [
    'Certified organic hemp',
    'Organically grown',
    'Pesticide-free formula',
    'Award-winning products',
    'Best dispensary in TN',
    '#1 rated store',
    'Top-rated hemp flower',
    'Strongest concentrate',
    'Most potent extract',
    'Highest THC content',
    'Highest CBD concentration',
  ];

  test.each(unverifiablePhrases)('flags for review: %s', phrase => {
    const result = validateContent(phrase, 'product');
    expect(result.violations.some(v => v.tier === 2)).toBe(true);
  });
});

// ── Tier 2 — Testimonial health claims ────────────────────────────────────

describe('Tier 2 — testimonial health claims', () => {
  const testimonialPhrases = [
    'This helped my anxiety',
    'It fixed my sleep problems',
    'Cured my chronic pain',
    'Treated my condition',
    'My doctor recommended this',
    'My physician recommended this product',
  ];

  test.each(testimonialPhrases)('flags for review: %s', phrase => {
    const result = validateContent(phrase, 'product');
    expect(result.violations.some(v => v.tier === 2)).toBe(true);
  });
});

// ── Tier 3 — SMS carrier blocked ──────────────────────────────────────────

describe('Tier 3 — SMS carrier blocked terms', () => {
  const smsPhrases = [
    'Premium kush strains',
    'Pre-rolls available',
    'Sativa dominant blend',
    'Indica strain',
    'Shatter concentrate',
    'Kief toppings',
    'Ganja vibes',
    'Dabs available',
    'Concentrates in stock',
    'Edibles selection',
    'Talk to our budtender',
    'No marijuana in stock',
    'Live resin products',
    'Bong accessories',
    'Vape pen available',
    'Come in on 420',
    '710 deals today',
  ];

  test.each(smsPhrases)('flags tier-3: %s', phrase => {
    const result = validateContent(phrase, 'product');
    expect(result.violations.some(v => v.tier === 3)).toBe(true);
  });

  it('is still valid (tier-3 does not block)', () => {
    const result = validateContent('Premium kush available', 'product');
    expect(result.valid).toBe(true);
  });
});

// ── Tier 3 — Slang risk ───────────────────────────────────────────────────

describe('Tier 3 — slang risk terms', () => {
  const slangPhrases = [
    'Top-shelf weed',
    'Quality pot',
    'Reefer madness sale',
    'Mary Jane selection',
    'Get stonked',
    'Get blazed with us',
    'Getting high made easy',
  ];

  test.each(slangPhrases)('flags tier-3: %s', phrase => {
    const result = validateContent(phrase, 'product');
    expect(result.violations.some(v => v.tier === 3)).toBe(true);
  });
});

// ── Context handling ───────────────────────────────────────────────────────

describe('context-specific behaviour', () => {
  it('returns empty missingDisclaimers for non-product contexts', () => {
    const result = validateContent('Some promo text', 'promo');
    expect(result.missingDisclaimers).toHaveLength(0);
  });

  it('returns missingDisclaimers for product context when disclaimers absent', () => {
    const result = validateContent(
      'A plain description with no disclaimers',
      'product'
    );
    expect(result.missingDisclaimers.length).toBeGreaterThan(0);
    expect(result.missingDisclaimers).toContain(
      'For use by adults 21 years of age or older.'
    );
    expect(result.missingDisclaimers).toContain(
      'Keep out of reach of children.'
    );
  });

  it('passes product disclaimers check when both are present', () => {
    const text =
      'Premium hemp flower. For use by adults 21 years of age or older. Keep out of reach of children.';
    const result = validateContent(text, 'product');
    expect(result.missingDisclaimers).toHaveLength(0);
  });

  it('seo-title context does not require disclaimers', () => {
    const result = validateContent(
      'Rush N Relax — Dispensary in TN',
      'seo-title'
    );
    expect(result.missingDisclaimers).toHaveLength(0);
  });

  it('location context does not require disclaimers', () => {
    const result = validateContent('Visit our Oak Ridge location', 'location');
    expect(result.missingDisclaimers).toHaveLength(0);
  });
});

// ── Suggestion population ─────────────────────────────────────────────────

describe('violation suggestions', () => {
  it('populates suggestion for known safe-alternative terms', () => {
    const result = validateContent('Same-day delivery available', 'product');
    const deliveryViolation = result.violations.find(v =>
      v.phrase.toLowerCase().includes('delivery')
    );
    expect(deliveryViolation?.suggestion).toBe('in-store pickup');
  });

  it('suggestion is undefined when no safe alternative is mapped', () => {
    const result = validateContent('Schedule I regulations', 'product');
    const violation = result.violations.find(v =>
      v.rule.includes('illegalFraming')
    );
    // No safe alternative mapped for "Schedule I" — suggestion may be undefined
    expect(violation).toBeDefined();
  });
});

// ── ValidationResult shape ────────────────────────────────────────────────

describe('ValidationResult shape', () => {
  it('returns all four fields on a clean string', () => {
    const result = validateContent('Premium hemp flower', 'promo');
    expect(result).toMatchObject({
      valid: true,
      requiresReview: false,
      violations: [],
      missingDisclaimers: [],
    });
  });

  it('violation has required fields', () => {
    const result = validateContent('This product treats pain', 'product');
    expect(result.violations[0]).toMatchObject({
      tier: 1,
      phrase: expect.any(String),
      rule: expect.stringContaining('tier1'),
      context: 'product',
    });
  });
});
