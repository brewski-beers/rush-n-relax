import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import {
  renderContactSubmissionEmailHtml,
  renderEmailSubject,
} from '@/lib/email-template-renderer';
import { getEmailTemplateById } from '@/lib/repositories/email-template.repository';
import type {
  ContactSubmissionPayload,
  EmailTemplate,
  OutboundEmailJob,
} from '@/types';

interface SubmitContactInput {
  name: string;
  email: string;
  phone?: string;
  message: string;
  userAgent?: string;
}

interface SubmitContactResult {
  submissionId: string;
  emailJobId: string;
}

interface QueueOutboundEmailInput {
  templateId?: string;
  subject: string;
  html: string;
  from: string;
  to: string[];
  payload: ContactSubmissionPayload;
}

function contactSubmissionsCol() {
  return getAdminFirestore().collection('contact-submissions');
}

function outboundEmailsCol() {
  return getAdminFirestore().collection('outbound-emails');
}

function maybeToDate(value: unknown): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (value instanceof Date || typeof value === 'string') {
    return toDate(value);
  }

  return undefined;
}

function docToOutboundEmailJob(
  id: string,
  d: FirebaseFirestore.DocumentData
): OutboundEmailJob {
  return {
    id,
    type: d.type,
    status: d.status,
    templateId: d.templateId,
    subject: d.subject,
    html: typeof d.html === 'string' ? d.html : undefined,
    from: d.from,
    to: Array.isArray(d.to) ? d.to : [],
    payload: d.payload,
    attemptCount: typeof d.attemptCount === 'number' ? d.attemptCount : 0,
    maxAttempts: typeof d.maxAttempts === 'number' ? d.maxAttempts : 5,
    provider: d.provider ?? undefined,
    providerMessageId: d.providerMessageId ?? undefined,
    errorMessage: d.errorMessage ?? undefined,
    nextAttemptAt: maybeToDate(d.nextAttemptAt),
    lastAttemptAt: maybeToDate(d.lastAttemptAt),
    createdAt: maybeToDate(d.createdAt) ?? new Date(0),
    updatedAt: maybeToDate(d.updatedAt) ?? new Date(0),
    sentAt: maybeToDate(d.sentAt),
  } satisfies OutboundEmailJob;
}

export async function listOutboundEmailJobs(
  limit = 100
): Promise<OutboundEmailJob[]> {
  const snap = await outboundEmailsCol()
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(doc => docToOutboundEmailJob(doc.id, doc.data()));
}

export async function requeueOutboundEmailJob(jobId: string): Promise<void> {
  const now = new Date();
  await outboundEmailsCol().doc(jobId).set(
    {
      status: 'queued',
      nextAttemptAt: now,
      updatedAt: now,
      errorMessage: null,
    },
    { merge: true }
  );
}

export async function queueOutboundEmail(
  input: QueueOutboundEmailInput
): Promise<string> {
  const now = new Date();
  const jobRef = outboundEmailsCol().doc();

  const emailJob: Omit<OutboundEmailJob, 'id'> = {
    type: 'contact-submission',
    status: 'queued',
    templateId: input.templateId ?? 'contact-submission-default',
    subject: input.subject,
    html: input.html,
    from: input.from,
    to: input.to,
    payload: input.payload,
    attemptCount: 0,
    maxAttempts: 5,
    provider: 'resend',
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await jobRef.set(emailJob);
  return jobRef.id;
}

async function renderQueuedEmail(params: {
  payload: ContactSubmissionPayload;
  fallbackSubject: string;
  templateId?: string;
  template?: EmailTemplate;
}): Promise<Pick<QueueOutboundEmailInput, 'templateId' | 'subject' | 'html'>> {
  const template =
    params.template ??
    (await getEmailTemplateById(
      params.templateId ?? 'contact-submission-default'
    ));

  return {
    templateId: template.id,
    subject:
      renderEmailSubject(template, params.payload) || params.fallbackSubject,
    html: renderContactSubmissionEmailHtml(params.payload, template),
  };
}

export async function submitContactAndQueueEmail(
  input: SubmitContactInput
): Promise<SubmitContactResult> {
  const db = getAdminFirestore();
  const now = new Date();
  const submittedAtIso = now.toISOString();

  const submissionRef = contactSubmissionsCol().doc();

  const payload: ContactSubmissionPayload = {
    submissionId: submissionRef.id,
    name: input.name,
    email: input.email,
    ...(input.phone ? { phone: input.phone } : {}),
    message: input.message,
    submittedAtIso,
    ...(input.userAgent ? { userAgent: input.userAgent } : {}),
  };

  const contactSubmissionDoc = {
    ...payload,
    createdAt: now,
    updatedAt: now,
  };

  const renderedEmail = await renderQueuedEmail({
    payload,
    fallbackSubject: `New contact submission from ${input.name}`,
    templateId: 'contact-submission-default',
  });

  const jobRef = outboundEmailsCol().doc();
  const emailJob: Omit<OutboundEmailJob, 'id'> = {
    type: 'contact-submission',
    status: 'queued',
    templateId: renderedEmail.templateId ?? 'contact-submission-default',
    subject: renderedEmail.subject,
    html: renderedEmail.html,
    from: 'Rush N Relax <no-reply@rushnrelax.com>',
    to: ['rush@rushnrelax.com', 'kb@rushnrelax.com'],
    payload,
    attemptCount: 0,
    maxAttempts: 5,
    provider: 'resend',
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(submissionRef, contactSubmissionDoc);
  batch.set(jobRef, emailJob);
  await batch.commit();

  return {
    submissionId: submissionRef.id,
    emailJobId: jobRef.id,
  };
}

export async function queueTestContactEmail(params: {
  to: string;
  templateId?: string;
  template?: EmailTemplate;
}): Promise<string> {
  const now = new Date();
  const payload: ContactSubmissionPayload = {
    submissionId: `test-${now.getTime()}`,
    name: 'Test Sender',
    email: 'test@rushnrelax.com',
    phone: '+1 (865) 555-0000',
    message:
      'This is a synthetic contact submission email generated from the Email Template CMS test-send action.',
    submittedAtIso: now.toISOString(),
    userAgent: 'admin-email-template-test-send',
  };

  const renderedEmail = await renderQueuedEmail({
    payload,
    fallbackSubject: 'Test contact submission email',
    templateId: params.templateId,
    template: params.template,
  });

  return queueOutboundEmail({
    templateId: renderedEmail.templateId,
    subject: renderedEmail.subject,
    html: renderedEmail.html,
    from: 'Rush N Relax <no-reply@rushnrelax.com>',
    to: [params.to],
    payload,
  });
}
