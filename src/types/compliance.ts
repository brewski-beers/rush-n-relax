export type ContentContext =
  | 'product'
  | 'promo'
  | 'seo-title'
  | 'seo-description'
  | 'structured-data'
  | 'location';

export type ViolationTier = 1 | 2 | 3;

export interface Violation {
  tier: ViolationTier;
  /** The matched text that triggered the violation */
  phrase: string;
  /** Which rule matched, e.g. 'tier1.medicalClaims[0]' */
  rule: string;
  /** Safe alternative from complianceConfig.safeAlternatives */
  suggestion?: string;
  context: ContentContext;
}

export interface ValidationResult {
  /** false if any tier-1 violations present */
  valid: boolean;
  /** true if any tier-2 violations present — content routes to review queue */
  requiresReview: boolean;
  violations: Violation[];
  missingDisclaimers: string[];
}

export type ComplianceLogType =
  | 'order'
  | 'inventory'
  | 'admin'
  | 'content-violation'
  | 'audit-violation';

/**
 * Immutable audit record written on every content/order/inventory mutation.
 * Lives at: tenants/{tenantId}/compliance-logs/{logId}
 * Write access: Cloud Functions only (enforced by Firestore security rules).
 */
export interface ComplianceLog {
  id: string;
  tenantId: string;
  type: ComplianceLogType;
  actorUid: string;
  timestamp: Date;
  /** State before the mutation */
  before?: Record<string, unknown>;
  /** State after the mutation */
  after?: Record<string, unknown>;
  /** Populated for content-violation and audit-violation types */
  violations?: Violation[];
  /** Reference to the affected document, e.g. products/{id} */
  subjectPath?: string;
}
