import type { ContactSubmissionPayload, EmailTemplate } from '@/types';

type RenderableTemplate = Pick<
  EmailTemplate,
  'id' | 'subjectTemplate' | 'theme' | 'containers'
>;

/**
 * Generic template render context.
 *
 * Supports nested objects so templates can reference dot-paths like
 * `{{ order.id }}`, `{{ customer.name }}`, `{{ deliveryAddress.line1 }}`,
 * etc. `ContactSubmissionPayload` is structurally compatible (flat keys).
 */
export type EmailTemplateContext = Record<string, unknown>;

/**
 * Order-context payload supplied for order-lifecycle emails. Keep this
 * intentionally lean — the renderer resolves arbitrary dot-paths off the
 * raw context object, so additional fields can be added without renderer
 * changes. Expand only as new templates require new tokens.
 */
export interface OrderEmailPayload extends Record<string, unknown> {
  order: {
    id: string;
    total?: number;
    paidAt?: string | Date;
    [key: string]: unknown;
  };
  customer: {
    name: string;
    email: string;
    [key: string]: unknown;
  };
  deliveryAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    [key: string]: unknown;
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Resolve a dot-notation path (`a.b.c`) against a context object.
 * Returns `undefined` if any segment is missing.
 */
function getByPath(context: EmailTemplateContext, path: string): unknown {
  const segments = path.split('.');
  let cursor: unknown = context;
  for (const segment of segments) {
    if (cursor === null || cursor === undefined) return undefined;
    if (typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function formatMoney(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }
  return 'N/A';
}

function formatDate(value: unknown): string {
  let date: Date | undefined;
  if (value instanceof Date) date = value;
  else if (typeof value === 'string' && value.trim() !== '') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    date = new Date(value);
  }
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function applyFilter(value: unknown, filter: string): string {
  switch (filter) {
    case 'money':
      return formatMoney(value);
    case 'date':
      return formatDate(value);
    default:
      // Unknown filter — fall back to safe string coercion.
      if (value === undefined || value === null) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      return '';
  }
}

/**
 * Render a template string, substituting `{{ token }}` and
 * `{{ token | filter }}` expressions against the given context.
 *
 * - Token resolution supports dot-notation: `{{ order.id }}`.
 * - Supported filters: `money`, `date`.
 * - Missing keys resolve to an empty string (subject) or 'N/A' (block values
 *   via `resolveBlockValue`); see callers for which behavior applies.
 */
export function renderTemplateString(
  template: string,
  context: EmailTemplateContext
): string {
  return template.replace(
    /\{\{\s*([\w.]+)(?:\s*\|\s*(\w+))?\s*\}\}/g,
    (_match, rawPath: string, filter: string | undefined) => {
      const value = getByPath(context, rawPath);
      if (filter) {
        return applyFilter(value, filter);
      }
      if (value === undefined || value === null) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      // Refuse to stringify objects/arrays — would emit "[object Object]".
      return '';
    }
  );
}

/**
 * Resolve a single block value (keyValue / message body) against a context,
 * returning 'N/A' for missing or empty values. Mirrors the legacy
 * `resolveValue` semantics for ContactSubmissionPayload.
 */
function resolveBlockValue(
  context: EmailTemplateContext,
  path: string
): string {
  const value = getByPath(context, path);
  if (typeof value === 'string') return value.trim() ? value : 'N/A';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'N/A';
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null) return 'N/A';
  if (typeof value === 'boolean') return String(value);
  return 'N/A';
}

/**
 * Render an email subject from a template and a generic context.
 *
 * Backward compatible with the legacy `ContactSubmissionPayload`-typed call
 * sites: any object satisfies `EmailTemplateContext`.
 */
export function renderEmailSubject(
  template: Pick<RenderableTemplate, 'subjectTemplate'>,
  context: EmailTemplateContext | ContactSubmissionPayload
): string {
  return renderTemplateString(
    template.subjectTemplate,
    context as EmailTemplateContext
  );
}

function renderBlocksHtml(
  template: Pick<RenderableTemplate, 'theme' | 'containers'>,
  context: EmailTemplateContext,
  // For 'message' block: if the context has a top-level `message` string
  // (legacy ContactSubmissionPayload), use it. Otherwise fall back to ''.
  legacyMessage?: string
): string {
  const { theme } = template;
  return template.containers
    .map(container => {
      const blocksHtml = container.blocks
        .map(block => {
          if (block.type === 'heading') {
            return `<h2 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:${escapeHtml(theme.accentColor)};">${escapeHtml(block.text)}</h2>`;
          }
          if (block.type === 'paragraph') {
            // Render paragraph text through the template engine so
            // {{ tokens }} (with optional filters) can be embedded inline.
            const rendered = renderTemplateString(block.text, context);
            return `<p style="margin:0 0 10px;color:${escapeHtml(theme.mutedTextColor)};font-size:14px;line-height:1.6;">${escapeHtml(rendered)}</p>`;
          }
          if (block.type === 'keyValue') {
            return `<p style="margin:0 0 8px;color:${escapeHtml(theme.textColor)};"><span style="color:${escapeHtml(theme.mutedTextColor)};">${escapeHtml(block.label)}:</span> ${escapeHtml(resolveBlockValue(context, block.valuePath))}</p>`;
          }
          if (block.type === 'message') {
            const messageValue =
              legacyMessage !== undefined
                ? legacyMessage
                : (() => {
                    const v = getByPath(context, 'message');
                    return typeof v === 'string' ? v : '';
                  })();
            return `<div style="margin-top:12px;padding:12px;border:1px solid ${escapeHtml(theme.borderColor)};border-radius:10px;background:${escapeHtml(theme.backgroundColor)};"><p style="margin:0 0 8px;color:${escapeHtml(theme.mutedTextColor)};font-size:13px;">${escapeHtml(block.label)}</p><p style="margin:0;white-space:pre-wrap;line-height:1.6;color:${escapeHtml(theme.textColor)};">${escapeHtml(messageValue)}</p></div>`;
          }
          if (block.type === 'divider') {
            return `<hr style="border:none;border-top:1px solid ${escapeHtml(theme.borderColor)};margin:12px 0;" />`;
          }
          return `<div style="height:${Math.max(4, block.heightPx)}px"></div>`;
        })
        .join('');
      return `<section style="margin-bottom:14px;">${blocksHtml}</section>`;
    })
    .join('');
}

function wrapHtml(
  theme: EmailTemplate['theme'],
  content: string
): string {
  return `<div style="background:${escapeHtml(theme.backgroundColor)};padding:24px;font-family:${escapeHtml(theme.fontFamily)};color:${escapeHtml(theme.textColor)};"><div style="max-width:680px;margin:0 auto;background:${escapeHtml(theme.panelColor)};border:1px solid ${escapeHtml(theme.borderColor)};border-radius:${theme.borderRadiusPx}px;overflow:hidden;padding:20px;">${content}</div></div>`;
}

/**
 * Render the HTML body for an email template against a generic context.
 * Use this for order-lifecycle templates (and any future contexts).
 */
export function renderEmailHtml(
  template: Pick<RenderableTemplate, 'theme' | 'containers'>,
  context: EmailTemplateContext
): string {
  const content = renderBlocksHtml(template, context);
  return wrapHtml(template.theme, content);
}

/**
 * Backward-compatible HTML renderer for contact-submission emails.
 * Preserves legacy semantics: the `message` block uses `payload.message`.
 */
export function renderContactSubmissionEmailHtml(
  payload: ContactSubmissionPayload,
  template: Pick<RenderableTemplate, 'theme' | 'containers'>
): string {
  const content = renderBlocksHtml(
    template,
    payload as unknown as EmailTemplateContext,
    payload.message
  );
  return wrapHtml(template.theme, content);
}

export function createEmailPreviewDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="margin:0;padding:0;background:transparent;">${html}</body></html>`;
}
