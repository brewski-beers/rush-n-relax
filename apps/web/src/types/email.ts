export type EmailTemplateId = string;

export type OutboundEmailStatus =
  | 'queued'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'dead-letter';

export interface ContactSubmissionPayload {
  submissionId: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  submittedAtIso: string;
  userAgent?: string;
}

export interface OutboundEmailJob {
  id: string;
  type: 'contact-submission';
  status: OutboundEmailStatus;
  templateId: EmailTemplateId;
  subject: string;
  html?: string;
  from: string;
  to: string[];
  payload: ContactSubmissionPayload;
  attemptCount: number;
  maxAttempts: number;
  provider?: 'resend';
  providerMessageId?: string;
  errorMessage?: string;
  nextAttemptAt?: Date;
  lastAttemptAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
}

export interface EmailTemplateTheme {
  backgroundColor: string;
  panelColor: string;
  textColor: string;
  accentColor: string;
  mutedTextColor: string;
  borderColor: string;
  fontFamily: string;
  borderRadiusPx: number;
}

/**
 * Path used by `keyValue` blocks to resolve a value from the render
 * context. Supports legacy ContactSubmissionPayload keys (`name`,
 * `email`, ...) as well as nested dot-notation paths for richer
 * contexts such as order emails (`order.id`, `customer.name`,
 * `deliveryAddress.line1`). The renderer treats any unresolved path
 * as `N/A`.
 */
export type EmailTemplateValuePath =
  | keyof ContactSubmissionPayload
  | (string & { readonly __nestedPath?: never });

export type EmailTemplateBlock =
  | {
      id: string;
      type: 'heading';
      text: string;
    }
  | {
      id: string;
      type: 'paragraph';
      text: string;
    }
  | {
      id: string;
      type: 'keyValue';
      label: string;
      valuePath: EmailTemplateValuePath;
    }
  | {
      id: string;
      type: 'message';
      label: string;
    }
  | {
      id: string;
      type: 'divider';
    }
  | {
      id: string;
      type: 'spacer';
      heightPx: number;
    };

export interface EmailTemplateContainer {
  id: string;
  label: string;
  blocks: EmailTemplateBlock[];
}

export interface EmailTemplate {
  id: EmailTemplateId;
  name: string;
  subjectTemplate: string;
  status: 'draft' | 'published';
  theme: EmailTemplateTheme;
  containers: EmailTemplateContainer[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplateRevision {
  id: string;
  templateId: EmailTemplateId;
  templateName: string;
  subjectTemplate: string;
  status: 'draft' | 'published';
  theme: EmailTemplateTheme;
  containers: EmailTemplateContainer[];
  source: 'save' | 'restore';
  restoredFromRevisionId?: string;
  createdAt: Date;
}
