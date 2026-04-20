import type { ValidationResult } from '@/types';
import { validateContent } from './validator';

export interface SeoFields {
  title?: string;
  description?: string;
}

/**
 * Validates SEO metadata fields through the compliance validator.
 * Returns a ValidationResult aggregating violations from all provided fields.
 */
export function validateSeoFields(fields: SeoFields): ValidationResult {
  const titleResult = fields.title
    ? validateContent(fields.title, 'seo-title')
    : null;

  const descResult = fields.description
    ? validateContent(fields.description, 'seo-description')
    : null;

  const allViolations = [
    ...(titleResult?.violations ?? []),
    ...(descResult?.violations ?? []),
  ];

  return {
    valid: allViolations.every(v => v.tier !== 1),
    requiresReview: allViolations.some(v => v.tier === 2),
    violations: allViolations,
    missingDisclaimers: [
      ...(titleResult?.missingDisclaimers ?? []),
      ...(descResult?.missingDisclaimers ?? []),
    ],
  };
}
