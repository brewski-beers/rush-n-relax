import type { ContentContext, Violation, ViolationTier } from '@/types';

/**
 * Pattern rules for a single tier.
 * Each pattern entry has a key (for the `rule` field) and a RegExp.
 */
export interface PatternRule {
  key: string;
  pattern: RegExp;
  /** If true, only fires in consumable content contexts (not 'accessory'/'merchandise') */
  consumableContextOnly?: boolean;
}

/**
 * Detect violations in `text` for the given tier patterns.
 * Returns one Violation per matching pattern (first match per rule).
 */
export function detectViolations(
  text: string,
  rules: PatternRule[],
  tier: ViolationTier,
  context: ContentContext,
  suggestion?: (phrase: string) => string | undefined
): Violation[] {
  const violations: Violation[] = [];

  for (const rule of rules) {
    if (rule.consumableContextOnly && isNonConsumableContext(context)) {
      continue;
    }

    const match = rule.pattern.exec(text);
    if (match) {
      violations.push({
        tier,
        phrase: match[0],
        rule: rule.key,
        context,
        suggestion: suggestion?.(match[0]),
      });
    }
  }

  return violations;
}

function isNonConsumableContext(context: ContentContext): boolean {
  return context === 'structured-data';
}
