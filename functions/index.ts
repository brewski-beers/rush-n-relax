import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { LOCATIONS } from './locations.config';

initializeApp();

const db = getFirestore();

const GOOGLE_PLACES_API_KEY = defineSecret('GOOGLE_PLACES_API_KEY');
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

const PLACES_API_BASE =
  'https://maps.googleapis.com/maps/api/place/details/json';
const FETCH_TIMEOUT_MS = 10_000;
const RESEND_SEND_API_URL = 'https://api.resend.com/emails';

interface ContactSubmissionPayload {
  submissionId: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  submittedAtIso: string;
  userAgent?: string;
}

interface OutboundEmailDoc {
  type: 'contact-submission';
  status: 'queued' | 'processing' | 'sent' | 'failed' | 'dead-letter';
  templateId: 'contact-submission-default';
  subject: string;
  html?: string;
  from: string;
  to: string[];
  payload: ContactSubmissionPayload;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: string | number | Date;
  lastAttemptAt?: string | number | Date;
}

interface EmailTemplateTheme {
  backgroundColor: string;
  panelColor: string;
  textColor: string;
  accentColor: string;
  mutedTextColor: string;
  borderColor: string;
  fontFamily: string;
  borderRadiusPx: number;
}

type EmailTemplateBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'paragraph'; text: string }
  | {
      id: string;
      type: 'keyValue';
      label: string;
      valuePath: keyof ContactSubmissionPayload;
    }
  | { id: string; type: 'message'; label: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; heightPx: number };

interface EmailTemplateContainer {
  id: string;
  label: string;
  blocks: EmailTemplateBlock[];
}

interface EmailTemplateDoc {
  id: 'contact-submission-default';
  name: string;
  subjectTemplate: string;
  theme: EmailTemplateTheme;
  containers: EmailTemplateContainer[];
}

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  relative_time_description: string;
  profile_photo_url: string;
  time: number;
}

interface PlacesApiResponse {
  status: string;
  error_message?: string;
  result?: {
    rating?: number;
    user_ratings_total?: number;
    reviews?: GoogleReview[];
  };
}

export async function fetchAndStoreReviews(
  placeId: string,
  apiKey: string
): Promise<void> {
  const url = new URL(PLACES_API_BASE);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'rating,user_ratings_total,reviews');
  url.searchParams.set('reviews_sort', 'newest');
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Google Places API returned HTTP ${response.status}`);
  }

  const json = (await response.json()) as PlacesApiResponse;
  if (json.status !== 'OK' || !json.result) {
    throw new Error(
      `Places API status: ${json.status} — ${json.error_message ?? ''}`
    );
  }

  await db
    .collection('location-reviews')
    .doc(placeId)
    .set({
      placeId,
      rating: json.result.rating ?? 0,
      totalRatings: json.result.user_ratings_total ?? 0,
      reviews: (json.result.reviews ?? []).slice(0, 5),
      cachedAt: Date.now(),
    });
}

export const refreshLocationReviews = onSchedule(
  { schedule: 'every 6 hours', secrets: [GOOGLE_PLACES_API_KEY] },
  async () => {
    const apiKey = GOOGLE_PLACES_API_KEY.value();
    if (!apiKey) {
      logger.error('GOOGLE_PLACES_API_KEY is not set — skipping refresh');
      return;
    }

    for (const location of LOCATIONS) {
      try {
        await fetchAndStoreReviews(location.placeId, apiKey);
        logger.info('Reviews refreshed', {
          placeId: location.placeId,
          name: location.name,
        });
      } catch (err) {
        logger.error('Failed to refresh reviews', {
          placeId: location.placeId,
          name: location.name,
          err,
        });
      }
    }
  }
);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDefaultEmailTemplate(): EmailTemplateDoc {
  return {
    id: 'contact-submission-default',
    name: 'Contact Submission Default',
    subjectTemplate: 'New contact submission from {{name}}',
    theme: {
      backgroundColor: '#0b1220',
      panelColor: '#111a2b',
      textColor: '#dce3f1',
      accentColor: '#d8c488',
      mutedTextColor: '#8fa6c8',
      borderColor: '#2a3b5f',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      borderRadiusPx: 14,
    },
    containers: [
      {
        id: 'header',
        label: 'Header',
        blocks: [
          { id: 'h1', type: 'heading', text: 'New Contact Submission' },
          {
            id: 'p1',
            type: 'paragraph',
            text: 'A new website contact form entry has arrived.',
          },
        ],
      },
      {
        id: 'details',
        label: 'Details',
        blocks: [
          { id: 'kv1', type: 'keyValue', label: 'Name', valuePath: 'name' },
          { id: 'kv2', type: 'keyValue', label: 'Email', valuePath: 'email' },
          { id: 'kv3', type: 'keyValue', label: 'Phone', valuePath: 'phone' },
          {
            id: 'kv4',
            type: 'keyValue',
            label: 'Submission ID',
            valuePath: 'submissionId',
          },
        ],
      },
      {
        id: 'message',
        label: 'Message',
        blocks: [
          { id: 'div1', type: 'divider' },
          { id: 'msg1', type: 'message', label: 'Message' },
        ],
      },
    ],
  };
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

function renderSubject(
  subjectTemplate: string,
  payload: ContactSubmissionPayload
): string {
  return subjectTemplate.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, token) => {
    const normalizedToken = String(token);

    if (
      normalizedToken === 'name' ||
      normalizedToken === 'email' ||
      normalizedToken === 'phone' ||
      normalizedToken === 'message' ||
      normalizedToken === 'submittedAtIso' ||
      normalizedToken === 'submissionId' ||
      normalizedToken === 'userAgent'
    ) {
      return resolveValue(payload, normalizedToken);
    }

    return '';
  });
}

function renderContactSubmissionEmailHtml(
  payload: ContactSubmissionPayload,
  template: EmailTemplateDoc
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

  return `
  <div style="background:${escapeHtml(template.theme.backgroundColor)};padding:24px;font-family:${escapeHtml(template.theme.fontFamily)};color:${escapeHtml(template.theme.textColor)};">
    <div style="max-width:680px;margin:0 auto;background:${escapeHtml(template.theme.panelColor)};border:1px solid ${escapeHtml(template.theme.borderColor)};border-radius:${template.theme.borderRadiusPx}px;overflow:hidden;padding:20px;">
      ${content}
    </div>
  </div>`;
}

async function loadEmailTemplate(
  templateId: OutboundEmailDoc['templateId']
): Promise<EmailTemplateDoc> {
  const fallback = getDefaultEmailTemplate();
  const doc = await db.collection('email-templates').doc(templateId).get();
  if (!doc.exists) {
    return fallback;
  }

  const d = doc.data() as Partial<EmailTemplateDoc> | undefined;
  if (!d || !Array.isArray(d.containers)) {
    return fallback;
  }

  return {
    ...fallback,
    ...d,
    theme: {
      ...fallback.theme,
      ...(d.theme ?? {}),
    },
    containers: d.containers,
  };
}

async function sendEmailWithResend(params: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
}): Promise<{ id: string }> {
  const response = await fetch(RESEND_SEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  const json = (await response.json()) as { id?: string; message?: string };

  if (!response.ok || !json.id) {
    throw new Error(
      json.message ?? `Resend request failed (${response.status})`
    );
  }

  return { id: json.id };
}

function toMillis(value: string | number | Date | undefined): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

function getRetryDelayMs(attemptCount: number): number {
  const delayMinutes = Math.min(
    60,
    Math.max(1, 2 ** Math.max(0, attemptCount - 1))
  );
  return delayMinutes * 60 * 1000;
}

async function processOutboundEmailJob(
  jobId: string,
  jobRef: FirebaseFirestore.DocumentReference,
  job: OutboundEmailDoc,
  apiKey: string
): Promise<void> {
  const startedAt = new Date();
  await jobRef.set(
    {
      status: 'processing',
      updatedAt: startedAt,
      lastAttemptAt: startedAt,
    },
    { merge: true }
  );

  try {
    const template = await loadEmailTemplate(job.templateId);
    const subject =
      job.subject || renderSubject(template.subjectTemplate, job.payload);
    const html =
      job.html ?? renderContactSubmissionEmailHtml(job.payload, template);
    const resendResponse = await sendEmailWithResend({
      apiKey,
      from: job.from,
      to: job.to,
      subject,
      html,
    });

    await jobRef.set(
      {
        status: 'sent',
        provider: 'resend',
        providerMessageId: resendResponse.id,
        sentAt: new Date(),
        updatedAt: new Date(),
        errorMessage: null,
      },
      { merge: true }
    );
    logger.info('Contact submission email sent', {
      jobId,
      providerMessageId: resendResponse.id,
    });
  } catch (error) {
    const nextAttemptCount = (job.attemptCount ?? 0) + 1;
    const maxAttempts = job.maxAttempts ?? 5;
    const nextAttemptAt = new Date(
      Date.now() + getRetryDelayMs(nextAttemptCount)
    );
    await jobRef.set(
      {
        status: nextAttemptCount >= maxAttempts ? 'dead-letter' : 'failed',
        attemptCount: nextAttemptCount,
        errorMessage:
          error instanceof Error ? error.message : 'Unknown send failure',
        nextAttemptAt,
        updatedAt: new Date(),
      },
      { merge: true }
    );
    logger.error('Failed to send contact submission email', {
      jobId,
      error,
      attemptCount: nextAttemptCount,
    });
  }
}

// ─── Order email job (PR #297 / #299) ─────────────────────────────────────
// Order lifecycle jobs are written by the order repository (see
// apps/web/src/lib/repositories/order.repository.ts) with shape:
//   { to: string, templateId: string, vars: { order, customer, deliveryAddress },
//     status: 'pending', createdAt }
// They lack a `type` field, which is how the trigger distinguishes them
// from contact-submission jobs.

interface OrderEmailJob {
  to: string;
  templateId: string;
  vars: {
    order: Record<string, unknown> & { id?: string };
    customer: { name?: string; email?: string; [key: string]: unknown };
    deliveryAddress?: Record<string, unknown> | null;
    [key: string]: unknown;
  };
  status: 'pending' | 'processing' | 'sent' | 'failed';
  from?: string;
  subject?: string;
  providerMessageId?: string;
}

const DEFAULT_ORDER_FROM = 'Rush N Relax <no-reply@rushnrelax.com>';

function isOrderEmailJob(data: unknown): data is OrderEmailJob {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if ('type' in d) return false;
  if (typeof d.templateId !== 'string') return false;
  if (typeof d.to !== 'string' || d.to.trim() === '') return false;
  if (!d.vars || typeof d.vars !== 'object') return false;
  return d.status === 'pending';
}

function getByPath(context: Record<string, unknown>, path: string): unknown {
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
  if (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !Number.isNaN(Number(value))
  ) {
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
      if (value === undefined || value === null) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      return '';
  }
}

/**
 * Render a `{{ token }}` / `{{ token | filter }}` template against a
 * generic context. Mirrors apps/web/src/lib/email-template-renderer.ts —
 * keep the two in sync if either is changed.
 */
export function renderTemplateString(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(
    /\{\{\s*([\w.]+)(?:\s*\|\s*(\w+))?\s*\}\}/g,
    (_match, rawPath: string, filter: string | undefined) => {
      const value = getByPath(context, rawPath);
      if (filter) return applyFilter(value, filter);
      if (value === undefined || value === null) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      return '';
    }
  );
}

function resolveBlockValueGeneric(
  context: Record<string, unknown>,
  path: string
): string {
  const value = getByPath(context, path);
  if (typeof value === 'string') return value.trim() ? value : 'N/A';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'N/A';
  }
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null) return 'N/A';
  if (typeof value === 'boolean') return String(value);
  return 'N/A';
}

/**
 * Render the HTML body of a generic email template against an arbitrary
 * context object. Used by order-lifecycle emails.
 */
export function renderEmailHtml(
  template: Pick<EmailTemplateDoc, 'theme' | 'containers'>,
  context: Record<string, unknown>
): string {
  const { theme } = template;
  const content = template.containers
    .map(container => {
      const blocksHtml = container.blocks
        .map(block => {
          if (block.type === 'heading') {
            return `<h2 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:${escapeHtml(theme.accentColor)};">${escapeHtml(block.text)}</h2>`;
          }
          if (block.type === 'paragraph') {
            const rendered = renderTemplateString(block.text, context);
            return `<p style="margin:0 0 10px;color:${escapeHtml(theme.mutedTextColor)};font-size:14px;line-height:1.6;">${escapeHtml(rendered)}</p>`;
          }
          if (block.type === 'keyValue') {
            return `<p style="margin:0 0 8px;color:${escapeHtml(theme.textColor)};"><span style="color:${escapeHtml(theme.mutedTextColor)};">${escapeHtml(block.label)}:</span> ${escapeHtml(resolveBlockValueGeneric(context, block.valuePath as string))}</p>`;
          }
          if (block.type === 'message') {
            const v = getByPath(context, 'message');
            const messageValue = typeof v === 'string' ? v : '';
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

  return `
  <div style="background:${escapeHtml(theme.backgroundColor)};padding:24px;font-family:${escapeHtml(theme.fontFamily)};color:${escapeHtml(theme.textColor)};">
    <div style="max-width:680px;margin:0 auto;background:${escapeHtml(theme.panelColor)};border:1px solid ${escapeHtml(theme.borderColor)};border-radius:${theme.borderRadiusPx}px;overflow:hidden;padding:20px;">
      ${content}
    </div>
  </div>`;
}

async function loadOrderEmailTemplate(
  templateId: string
): Promise<EmailTemplateDoc | null> {
  const doc = await db.collection('email-templates').doc(templateId).get();
  if (!doc.exists) return null;
  const d = doc.data() as Partial<EmailTemplateDoc> | undefined;
  if (!d || !Array.isArray(d.containers) || !d.theme) return null;
  return {
    id: (d.id ?? templateId) as EmailTemplateDoc['id'],
    name: d.name ?? templateId,
    subjectTemplate: d.subjectTemplate ?? '',
    theme: d.theme,
    containers: d.containers,
  };
}

async function processOrderEmailJob(
  jobId: string,
  jobRef: FirebaseFirestore.DocumentReference,
  job: OrderEmailJob,
  apiKey: string
): Promise<void> {
  const startedAt = new Date();
  await jobRef.set(
    { status: 'processing', updatedAt: startedAt, lastAttemptAt: startedAt },
    { merge: true }
  );

  try {
    const template = await loadOrderEmailTemplate(job.templateId);
    if (!template) {
      throw new Error(
        `Email template '${job.templateId}' not found in email-templates collection`
      );
    }

    const subject = renderTemplateString(
      job.subject || template.subjectTemplate,
      job.vars
    );
    const html = renderEmailHtml(template, job.vars);
    const from = job.from || DEFAULT_ORDER_FROM;

    const resendResponse = await sendEmailWithResend({
      apiKey,
      from,
      to: [job.to],
      subject,
      html,
    });

    await jobRef.set(
      {
        status: 'sent',
        provider: 'resend',
        providerMessageId: resendResponse.id,
        sentAt: new Date(),
        updatedAt: new Date(),
        errorMessage: null,
      },
      { merge: true }
    );
    logger.info('Order email sent', {
      jobId,
      templateId: job.templateId,
      providerMessageId: resendResponse.id,
    });
  } catch (error) {
    await jobRef.set(
      {
        status: 'failed',
        errorMessage:
          error instanceof Error ? error.message : 'Unknown send failure',
        updatedAt: new Date(),
      },
      { merge: true }
    );
    logger.error('Failed to send order email', {
      jobId,
      templateId: job.templateId,
      error,
    });
  }
}

export const sendQueuedContactEmails = onDocumentCreated(
  {
    document: 'outbound-emails/{jobId}',
    secrets: [RESEND_API_KEY],
  },
  async event => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const jobRef = snapshot.ref;
    const raw = snapshot.data();

    // Branch by job shape:
    //   - contact-submission: { type: 'contact-submission', status: 'queued', ... }
    //   - order lifecycle    : { templateId, vars, to, status: 'pending' } (no `type`)
    const isContactJob =
      !!raw &&
      typeof raw === 'object' &&
      (raw as { type?: unknown }).type === 'contact-submission' &&
      (raw as { status?: unknown }).status === 'queued';

    const isOrderJob = isOrderEmailJob(raw);

    if (!isContactJob && !isOrderJob) {
      return;
    }

    const apiKey = RESEND_API_KEY.value();
    if (!apiKey) {
      logger.error('RESEND_API_KEY is not set; cannot dispatch outbound email');
      await jobRef.set(
        {
          status: 'failed',
          errorMessage: 'RESEND_API_KEY missing',
          updatedAt: new Date(),
        },
        { merge: true }
      );
      return;
    }

    if (isContactJob) {
      await processOutboundEmailJob(
        snapshot.id,
        jobRef,
        raw as OutboundEmailDoc,
        apiKey
      );
    } else {
      // isOrderJob narrowed by the type guard above
      await processOrderEmailJob(
        snapshot.id,
        jobRef,
        raw as OrderEmailJob,
        apiKey
      );
    }
  }
);

export const retryFailedOutboundEmails = onSchedule(
  {
    schedule: 'every 10 minutes',
    secrets: [RESEND_API_KEY],
  },
  async () => {
    const apiKey = RESEND_API_KEY.value();
    if (!apiKey) {
      logger.error(
        'RESEND_API_KEY is not set; skipping outbound email retries'
      );
      return;
    }

    const now = Date.now();
    const failedJobs = await db
      .collection('outbound-emails')
      .where('status', '==', 'failed')
      .get();

    for (const doc of failedJobs.docs) {
      const job = doc.data() as OutboundEmailDoc;
      const nextAttemptAtMs = toMillis(job.nextAttemptAt);
      if (nextAttemptAtMs > now) {
        continue;
      }

      await processOutboundEmailJob(doc.id, doc.ref, job, apiKey);
    }
  }
);
