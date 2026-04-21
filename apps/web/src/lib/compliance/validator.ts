/**
 * Main compliance validation entry point.
 * Call validateContent(text, context) anywhere content is written or rendered.
 */
import type { ContentContext, ValidationResult } from '@/types';
import { detectViolations } from './phrase-detector';
import { checkRequiredDisclaimers } from './disclaimer-checker';
import { getSuggestion } from './config';
import {
  tier1MedicalClaims,
  tier1DeliveryShipping,
  tier1IllegalFraming,
  tier1MinorTargeting,
  tier2HealthBenefitClaims,
  tier2UnverifiableClaims,
  tier2TestimonialHealth,
  tier3SmsCarrierBlocked,
  tier3SlangRisk,
} from './config';

export function validateContent(
  text: string,
  context: ContentContext
): ValidationResult {
  const tier1Violations = [
    ...detectViolations(text, tier1MedicalClaims, 1, context, getSuggestion),
    ...detectViolations(text, tier1DeliveryShipping, 1, context, getSuggestion),
    ...detectViolations(text, tier1IllegalFraming, 1, context, getSuggestion),
    ...detectViolations(text, tier1MinorTargeting, 1, context, getSuggestion),
  ];

  const tier2Violations = [
    ...detectViolations(
      text,
      tier2HealthBenefitClaims,
      2,
      context,
      getSuggestion
    ),
    ...detectViolations(
      text,
      tier2UnverifiableClaims,
      2,
      context,
      getSuggestion
    ),
    ...detectViolations(
      text,
      tier2TestimonialHealth,
      2,
      context,
      getSuggestion
    ),
  ];

  const tier3Violations = [
    ...detectViolations(
      text,
      tier3SmsCarrierBlocked,
      3,
      context,
      getSuggestion
    ),
    ...detectViolations(text, tier3SlangRisk, 3, context, getSuggestion),
  ];

  const violations = [
    ...tier1Violations,
    ...tier2Violations,
    ...tier3Violations,
  ];

  return {
    valid: tier1Violations.length === 0,
    requiresReview: tier2Violations.length > 0,
    violations,
    missingDisclaimers: checkRequiredDisclaimers(text, context),
  };
}
