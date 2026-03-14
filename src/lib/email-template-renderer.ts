import type { ContactSubmissionPayload, EmailTemplate } from '@/types';

type RenderableTemplate = Pick<
  EmailTemplate,
  'id' | 'subjectTemplate' | 'theme' | 'containers'
>;

function isValuePath(token: string): token is keyof ContactSubmissionPayload {
  return (
    token === 'name' ||
    token === 'email' ||
    token === 'phone' ||
    token === 'message' ||
    token === 'submittedAtIso' ||
    token === 'submissionId' ||
    token === 'userAgent'
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveValue(
  payload: ContactSubmissionPayload,
  path: keyof ContactSubmissionPayload
): string {
  const value = payload[path];
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return 'N/A';
}

export function renderEmailSubject(
  template: Pick<RenderableTemplate, 'subjectTemplate'>,
  payload: ContactSubmissionPayload
): string {
  return template.subjectTemplate.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (_match, token) => {
      const normalizedToken = String(token);
      if (isValuePath(normalizedToken)) {
        return resolveValue(payload, normalizedToken);
      }

      return '';
    }
  );
}

export function renderContactSubmissionEmailHtml(
  payload: ContactSubmissionPayload,
  template: Pick<RenderableTemplate, 'theme' | 'containers'>
): string {
  const content = template.containers
    .map(container => {
      const blocksHtml = container.blocks
        .map(block => {
          if (block.type === 'heading') {
            return `<h2 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:${escapeHtml(template.theme.accentColor)};">${escapeHtml(block.text)}</h2>`;
          }

          if (block.type === 'paragraph') {
            return `<p style="margin:0 0 10px;color:${escapeHtml(template.theme.mutedTextColor)};font-size:14px;line-height:1.6;">${escapeHtml(block.text)}</p>`;
          }

          if (block.type === 'keyValue') {
            return `<p style="margin:0 0 8px;color:${escapeHtml(template.theme.textColor)};"><span style="color:${escapeHtml(template.theme.mutedTextColor)};">${escapeHtml(block.label)}:</span> ${escapeHtml(resolveValue(payload, block.valuePath))}</p>`;
          }

          if (block.type === 'message') {
            return `<div style="margin-top:12px;padding:12px;border:1px solid ${escapeHtml(template.theme.borderColor)};border-radius:10px;background:${escapeHtml(template.theme.backgroundColor)};"><p style="margin:0 0 8px;color:${escapeHtml(template.theme.mutedTextColor)};font-size:13px;">${escapeHtml(block.label)}</p><p style="margin:0;white-space:pre-wrap;line-height:1.6;color:${escapeHtml(template.theme.textColor)};">${escapeHtml(payload.message)}</p></div>`;
          }

          if (block.type === 'divider') {
            return `<hr style="border:none;border-top:1px solid ${escapeHtml(template.theme.borderColor)};margin:12px 0;" />`;
          }

          return `<div style="height:${Math.max(4, block.heightPx)}px"></div>`;
        })
        .join('');

      return `<section style="margin-bottom:14px;">${blocksHtml}</section>`;
    })
    .join('');

  return `<div style="background:${escapeHtml(template.theme.backgroundColor)};padding:24px;font-family:${escapeHtml(template.theme.fontFamily)};color:${escapeHtml(template.theme.textColor)};"><div style="max-width:680px;margin:0 auto;background:${escapeHtml(template.theme.panelColor)};border:1px solid ${escapeHtml(template.theme.borderColor)};border-radius:${template.theme.borderRadiusPx}px;overflow:hidden;padding:20px;">${content}</div></div>`;
}

export function createEmailPreviewDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="margin:0;padding:0;background:transparent;">${html}</body></html>`;
}
