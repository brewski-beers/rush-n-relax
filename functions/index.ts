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
    const job = snapshot.data() as OutboundEmailDoc;

    if (job.type !== 'contact-submission' || job.status !== 'queued') {
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

    await processOutboundEmailJob(snapshot.id, jobRef, job, apiKey);
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
