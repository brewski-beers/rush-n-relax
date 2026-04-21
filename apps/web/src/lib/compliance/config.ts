/**
 * Compliance configuration — hardcoded, version-controlled, never stored in Firestore.
 * Admins cannot see or modify this. Only updated via PR with explicit compliance review.
 *
 * Jurisdiction: Tennessee Hemp-Derived Cannabinoid (Farm Bill / TABC)
 */

import type { PatternRule } from './phrase-detector';

// ── Tier 1 — Hard block (regulatory violation) ────────────────────────────

export const tier1MedicalClaims: PatternRule[] = [
  {
    key: 'tier1.medicalClaims[0]',
    pattern:
      /\b(treat(?:s|ed|ment|ing)?|cure[sd]?|curative|prevent(?:s|ed|ion|ing)?|diagnos[ei](?:s|ng)?|heal(?:s|ed|ing)?|medicat(?:e|es|ed|ing|ion)?|prescri(?:be|bes|bed|bing|ption))\b/i,
  },
  {
    key: 'tier1.medicalClaims[1]',
    pattern:
      /\b(fda[- ]approved|fda[- ]cleared|clinically[- ](?:proven|tested|studied))\b/i,
  },
  {
    key: 'tier1.medicalClaims[2]',
    pattern:
      /\b(replaces?\s+medication|alternative\s+to\s+\w+\s+medication)\b/i,
  },
];

export const tier1DeliveryShipping: PatternRule[] = [
  {
    key: 'tier1.deliveryShipping[0]',
    pattern: /\bdeliver(?:y|ing|ed|s|ies)?\b/i,
    consumableContextOnly: true,
  },
  {
    key: 'tier1.deliveryShipping[1]',
    pattern: /\bship(?:ping|ped|s|ment)?\s+to\b/i,
    consumableContextOnly: true,
  },
  {
    key: 'tier1.deliveryShipping[2]',
    pattern: /\b(?:mail|postal)\s+order\b/i,
    consumableContextOnly: true,
  },
  {
    key: 'tier1.deliveryShipping[3]',
    pattern: /\bnationwide\b/i,
    consumableContextOnly: true,
  },
  {
    key: 'tier1.deliveryShipping[4]',
    pattern: /\bacross\s+state\s+lines?\b/i,
    consumableContextOnly: true,
  },
  {
    key: 'tier1.deliveryShipping[5]',
    pattern: /\bonline\s+order(?:ing)?\b/i,
    consumableContextOnly: true,
  },
];

export const tier1IllegalFraming: PatternRule[] = [
  {
    key: 'tier1.illegalFraming[0]',
    pattern: /\brecreational\s+(?:cannabis|marijuana|weed|pot)\b/i,
  },
  {
    key: 'tier1.illegalFraming[1]',
    pattern: /\bmedical\s+marijuana\b/i,
  },
  {
    key: 'tier1.illegalFraming[2]',
    pattern: /\bMMJ\b/,
  },
  {
    key: 'tier1.illegalFraming[3]',
    pattern: /\bschedule\s+(?:i|1)\b/i,
  },
  {
    key: 'tier1.illegalFraming[4]',
    pattern: /\bfederally\s+illegal\b/i,
  },
  {
    key: 'tier1.illegalFraming[5]',
    pattern: /\bcontrolled\s+substance\b/i,
  },
];

export const tier1MinorTargeting: PatternRule[] = [
  {
    key: 'tier1.minorTargeting[0]',
    pattern: /\b(?:kids|children|youth|teens?|minors?)\b/i,
  },
  {
    key: 'tier1.minorTargeting[1]',
    pattern: /\b(?:cartoon|superhero|anime)\b/i,
  },
];

// ── Tier 2 — Requires human review ────────────────────────────────────────

export const tier2HealthBenefitClaims: PatternRule[] = [
  {
    key: 'tier2.healthBenefitClaims[0]',
    pattern: /\b(?:reliev(?:e[sd]?|ing|er)|relief)\b/i,
  },
  {
    key: 'tier2.healthBenefitClaims[1]',
    pattern: /\bpain\s+(?:management|relief|reduction)\b/i,
  },
  {
    key: 'tier2.healthBenefitClaims[2]',
    pattern: /\banxiety\s+(?:relief|treatment|management|reduction)\b/i,
  },
  {
    key: 'tier2.healthBenefitClaims[3]',
    pattern: /\bsleep\s+(?:aid|support|help|assist)\b/i,
  },
  {
    key: 'tier2.healthBenefitClaims[4]',
    pattern: /\bstress\s+(?:relief|reduc(?:tion|er))\b/i,
  },
  {
    key: 'tier2.healthBenefitClaims[5]',
    pattern: /\banti[- ](?:inflammatory|anxiety|depressant|nausea)\b/i,
  },
  {
    key: 'tier2.healthBenefitClaims[6]',
    pattern: /\b(?:therapeutic|therapy|holistic|wellness|natural\s+remedy)\b/i,
  },
  {
    key: 'tier2.healthBenefitClaims[7]',
    pattern: /\bboosts?\s+immunity\b/i,
  },
  {
    key: 'tier2.healthBenefitClaims[8]',
    pattern: /\bmental\s+health\s+(?:support|treatment|benefit)\b/i,
  },
];

export const tier2UnverifiableClaims: PatternRule[] = [
  {
    key: 'tier2.unverifiableClaims[0]',
    pattern: /\borganic(?:ally)?\b/i,
  },
  {
    key: 'tier2.unverifiableClaims[1]',
    pattern: /\bpesticide[- ]free\b/i,
  },
  {
    key: 'tier2.unverifiableClaims[2]',
    pattern: /\b(?:best|award[- ]winning|top[- ]rated)\b|(?<!\w)#1\b/i,
  },
  {
    key: 'tier2.unverifiableClaims[3]',
    pattern: /\b(?:strongest|most\s+potent|highest\s+(?:thc|cbd))\b/i,
  },
];

export const tier2TestimonialHealth: PatternRule[] = [
  {
    key: 'tier2.testimonialHealth[0]',
    pattern: /\b(?:helped?|fixed|cured|treated)\s+my\b/i,
  },
  {
    key: 'tier2.testimonialHealth[1]',
    pattern: /\bmy\s+(?:doctor|physician)\s+recommended\b/i,
  },
];

// ── Tier 3 — Platform restriction ─────────────────────────────────────────

export const tier3SmsCarrierBlocked: PatternRule[] = [
  { key: 'tier3.smsCarrierBlocked[0]', pattern: /\bkush\b/i },
  { key: 'tier3.smsCarrierBlocked[1]', pattern: /\bpre[- ]?rolls?\b/i },
  { key: 'tier3.smsCarrierBlocked[2]', pattern: /\bsativa\b/i },
  { key: 'tier3.smsCarrierBlocked[3]', pattern: /\bindica\b/i },
  { key: 'tier3.smsCarrierBlocked[4]', pattern: /\bshatter\b/i },
  { key: 'tier3.smsCarrierBlocked[5]', pattern: /\bkief\b/i },
  { key: 'tier3.smsCarrierBlocked[6]', pattern: /\bganja\b/i },
  { key: 'tier3.smsCarrierBlocked[7]', pattern: /\bdabs?\b/i },
  { key: 'tier3.smsCarrierBlocked[8]', pattern: /\bconcentrate[sd]?\b/i },
  { key: 'tier3.smsCarrierBlocked[9]', pattern: /\bedibles?\b/i },
  { key: 'tier3.smsCarrierBlocked[10]', pattern: /\bbudtender\b/i },
  { key: 'tier3.smsCarrierBlocked[11]', pattern: /\bmarijuana\b/i },
  { key: 'tier3.smsCarrierBlocked[12]', pattern: /\bresin\b/i },
  { key: 'tier3.smsCarrierBlocked[13]', pattern: /\bbong\b/i },
  { key: 'tier3.smsCarrierBlocked[14]', pattern: /\bvape\s*pen\b/i },
  { key: 'tier3.smsCarrierBlocked[15]', pattern: /\b420\b/ },
  { key: 'tier3.smsCarrierBlocked[16]', pattern: /\b710\b/ },
];

export const tier3SlangRisk: PatternRule[] = [
  { key: 'tier3.slangRisk[0]', pattern: /\bweed\b/i },
  { key: 'tier3.slangRisk[1]', pattern: /\bpot\b/i },
  { key: 'tier3.slangRisk[2]', pattern: /\breefer\b/i },
  { key: 'tier3.slangRisk[3]', pattern: /\bmary\s+jane\b/i },
  { key: 'tier3.slangRisk[4]', pattern: /\bstonked?\b/i },
  { key: 'tier3.slangRisk[5]', pattern: /\bblazed\b/i },
  { key: 'tier3.slangRisk[6]', pattern: /\bgetting\s+high\b/i },
];

// ── Safe alternatives ──────────────────────────────────────────────────────

export const safeAlternatives = new Map<string, string>([
  ['medical marijuana', 'hemp-derived cannabinoid products'],
  ['recreational', 'hemp-derived'],
  ['weed', 'cannabis flower'],
  ['pot', 'cannabis'],
  ['delivery', 'in-store pickup'],
  ['ship', 'available in-store'],
  ['treats', 'may be enjoyed as'],
  ['relief', 'enjoyed by customers'],
  ['healing', 'enjoyed for its characteristics'],
  ['organic', 'naturally cultivated (COA required to verify)'],
]);

export function getSuggestion(phrase: string): string | undefined {
  const lower = phrase.toLowerCase();
  for (const [term, suggestion] of safeAlternatives) {
    if (lower.includes(term)) return suggestion;
  }
  return undefined;
}

// ── Required disclaimers ───────────────────────────────────────────────────

export const requiredDisclaimers = {
  productPage: [
    'For use by adults 21 years of age or older.',
    'Keep out of reach of children.',
  ],
  sitewide: [
    'Hemp-derived cannabinoid products comply with federal hemp regulations.',
    'Consumable hemp products available in-store at licensed Tennessee retail locations.',
    'Accessories and merchandise available for nationwide shipping.',
  ],
  checkout: [
    'Valid government-issued ID required at time of purchase.',
    'In-store only. No delivery or shipping available.',
  ],
} as const;

// ── Schema.org guardrails ──────────────────────────────────────────────────

export const allowedSchemaTypes = [
  'LocalBusiness',
  'Store',
  'Organization',
  'Product',
  'FAQPage',
  'BreadcrumbList',
  'ItemList',
  'WebSite',
  'Offer',
] as const;

export const forbiddenSchemaTypes = [
  'Pharmacy',
  'MedicalBusiness',
  'MedicalOrganization',
  'Hospital',
  'Physician',
  'DrugLegalStatus',
] as const;

export type AllowedSchemaType = (typeof allowedSchemaTypes)[number];
export type ForbiddenSchemaType = (typeof forbiddenSchemaTypes)[number];
