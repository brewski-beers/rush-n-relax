import { cache } from 'react';
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import { createId } from '@/lib/utils/id';
import type {
  EmailTemplate,
  EmailTemplateBlock,
  EmailTemplateContainer,
  EmailTemplateId,
  EmailTemplateRevision,
  EmailTemplateTheme,
  EmailTemplateValuePath,
} from '@/types';

const CONTACT_TEMPLATE_ID: EmailTemplateId = 'contact-submission-default';

function emailTemplatesCol() {
  return getAdminFirestore().collection('email-templates');
}

function emailTemplateRevisionsCol() {
  return getAdminFirestore().collection('email-template-revisions');
}

const DEFAULT_THEME: EmailTemplateTheme = {
  backgroundColor: '#0b1220',
  panelColor: '#111a2b',
  textColor: '#dce3f1',
  accentColor: '#d8c488',
  mutedTextColor: '#8fa6c8',
  borderColor: '#2a3b5f',
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  borderRadiusPx: 14,
};

function defaultContainers(): EmailTemplateContainer[] {
  return [
    {
      id: createId('container'),
      label: 'Header',
      blocks: [
        {
          id: createId('block'),
          type: 'heading',
          text: 'New Contact Submission',
        },
        {
          id: createId('block'),
          type: 'paragraph',
          text: 'A new website contact form entry has arrived.',
        },
      ],
    },
    {
      id: createId('container'),
      label: 'Details',
      blocks: [
        {
          id: createId('block'),
          type: 'keyValue',
          label: 'Name',
          valuePath: 'name',
        },
        {
          id: createId('block'),
          type: 'keyValue',
          label: 'Email',
          valuePath: 'email',
        },
        {
          id: createId('block'),
          type: 'keyValue',
          label: 'Phone',
          valuePath: 'phone',
        },
        {
          id: createId('block'),
          type: 'keyValue',
          label: 'Submitted At',
          valuePath: 'submittedAtIso',
        },
        {
          id: createId('block'),
          type: 'keyValue',
          label: 'Submission ID',
          valuePath: 'submissionId',
        },
      ],
    },
    {
      id: createId('container'),
      label: 'Message',
      blocks: [
        {
          id: createId('block'),
          type: 'divider',
        },
        {
          id: createId('block'),
          type: 'message',
          label: 'Message',
        },
      ],
    },
  ];
}

export function getDefaultContactEmailTemplate(): EmailTemplate {
  return getDefaultEmailTemplate(CONTACT_TEMPLATE_ID);
}

function getDefaultEmailTemplate(templateId: EmailTemplateId): EmailTemplate {
  const now = new Date();
  return {
    id: templateId,
    name:
      templateId === CONTACT_TEMPLATE_ID
        ? 'Contact Submission Default'
        : `Template ${templateId}`,
    subjectTemplate: 'New contact submission from {{name}}',
    status: 'published',
    theme: DEFAULT_THEME,
    containers: defaultContainers(),
    createdAt: now,
    updatedAt: now,
  };
}

export const getEmailTemplateById = cache(
  async (templateId: EmailTemplateId): Promise<EmailTemplate> => {
    const doc = await emailTemplatesCol().doc(templateId).get();
    if (!doc.exists) {
      return getDefaultEmailTemplate(templateId);
    }

    return docToEmailTemplate(doc.id, doc.data()!);
  }
);

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  const snap = await emailTemplatesCol().orderBy('updatedAt', 'desc').get();
  if (snap.empty) {
    return [getDefaultContactEmailTemplate()];
  }

  return snap.docs.map(doc => docToEmailTemplate(doc.id, doc.data()));
}

export async function upsertEmailTemplate(
  template: Omit<EmailTemplate, 'createdAt' | 'updatedAt'>
): Promise<void> {
  await persistEmailTemplate(template, { source: 'save' });
}

export async function listEmailTemplateRevisions(
  templateId: EmailTemplateId,
  limit = 12
): Promise<EmailTemplateRevision[]> {
  const snap = await emailTemplateRevisionsCol()
    .where('templateId', '==', templateId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => docToEmailTemplateRevision(doc.id, doc.data()));
}

export async function restoreEmailTemplateRevision(
  templateId: EmailTemplateId,
  revisionId: string
): Promise<void> {
  const revisionDoc = await emailTemplateRevisionsCol().doc(revisionId).get();
  if (!revisionDoc.exists) {
    throw new Error('Revision not found.');
  }

  const revision = docToEmailTemplateRevision(
    revisionDoc.id,
    revisionDoc.data()!
  );
  if (revision.templateId !== templateId) {
    throw new Error('Revision does not belong to this template.');
  }

  await persistEmailTemplate(
    {
      id: revision.templateId,
      name: revision.templateName,
      subjectTemplate: revision.subjectTemplate,
      status: revision.status,
      theme: revision.theme,
      containers: revision.containers,
    },
    {
      source: 'restore',
      restoredFromRevisionId: revision.id,
    }
  );
}

async function persistEmailTemplate(
  template: Omit<EmailTemplate, 'createdAt' | 'updatedAt'>,
  options: {
    source: EmailTemplateRevision['source'];
    restoredFromRevisionId?: string;
  }
): Promise<void> {
  const now = new Date();
  const templateRef = emailTemplatesCol().doc(template.id);
  const existing = await templateRef.get();
  const createdAt = existing.exists ? toDate(existing.data()?.createdAt) : now;
  const nextTemplate: EmailTemplate = {
    ...template,
    createdAt,
    updatedAt: now,
  };
  const revisionRef = emailTemplateRevisionsCol().doc(
    createId('template-revision')
  );
  const db = getAdminFirestore();
  const batch = db.batch();

  batch.set(templateRef, nextTemplate);
  batch.set(revisionRef, {
    templateId: nextTemplate.id,
    templateName: nextTemplate.name,
    subjectTemplate: nextTemplate.subjectTemplate,
    status: nextTemplate.status,
    theme: nextTemplate.theme,
    containers: nextTemplate.containers,
    source: options.source,
    ...(options.restoredFromRevisionId
      ? { restoredFromRevisionId: options.restoredFromRevisionId }
      : {}),
    createdAt: now,
  });

  await batch.commit();
}

// Allow legacy ContactSubmissionPayload keys plus any dot-notation path
// composed of word characters (e.g. `order.id`, `customer.name`,
// `deliveryAddress.line1`). Anything else falls back to `'message'` so
// stored data never contains shapes the renderer cannot handle.
const VALUE_PATH_PATTERN = /^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/;

function sanitizeValuePath(value: unknown): EmailTemplateValuePath {
  if (typeof value === 'string' && VALUE_PATH_PATTERN.test(value)) {
    return value;
  }

  return 'message';
}

function sanitizeBlock(block: unknown): EmailTemplateBlock | null {
  if (typeof block !== 'object' || block === null) {
    return null;
  }

  const d = block as Record<string, unknown>;
  const id = typeof d.id === 'string' ? d.id : createId('block');
  const type = d.type;

  if (type === 'heading') {
    return {
      id,
      type,
      text: typeof d.text === 'string' ? d.text : 'Heading',
    };
  }

  if (type === 'paragraph') {
    return {
      id,
      type,
      text: typeof d.text === 'string' ? d.text : 'Paragraph',
    };
  }

  if (type === 'keyValue') {
    return {
      id,
      type,
      label: typeof d.label === 'string' ? d.label : 'Label',
      valuePath: sanitizeValuePath(d.valuePath),
    };
  }

  if (type === 'message') {
    return {
      id,
      type,
      label: typeof d.label === 'string' ? d.label : 'Message',
    };
  }

  if (type === 'divider') {
    return {
      id,
      type,
    };
  }

  if (type === 'spacer') {
    return {
      id,
      type,
      heightPx:
        typeof d.heightPx === 'number' && d.heightPx > 0
          ? Math.round(d.heightPx)
          : 16,
    };
  }

  return null;
}

function sanitizeContainer(container: unknown): EmailTemplateContainer | null {
  if (typeof container !== 'object' || container === null) {
    return null;
  }

  const d = container as Record<string, unknown>;
  const blocks = Array.isArray(d.blocks)
    ? d.blocks.map(sanitizeBlock).filter(Boolean)
    : [];

  return {
    id: typeof d.id === 'string' ? d.id : createId('container'),
    label: typeof d.label === 'string' ? d.label : 'Container',
    blocks: blocks as EmailTemplateBlock[],
  };
}

function docToEmailTemplate(
  id: EmailTemplateId,
  d: FirebaseFirestore.DocumentData
): EmailTemplate {
  const containers = Array.isArray(d.containers)
    ? d.containers.map(sanitizeContainer).filter(Boolean)
    : [];
  const fallback = getDefaultContactEmailTemplate();

  return {
    id,
    name: typeof d.name === 'string' ? d.name : fallback.name,
    subjectTemplate:
      typeof d.subjectTemplate === 'string'
        ? d.subjectTemplate
        : fallback.subjectTemplate,
    status: d.status === 'draft' ? 'draft' : 'published',
    theme: {
      ...fallback.theme,
      ...(typeof d.theme === 'object' && d.theme !== null
        ? (d.theme as Partial<EmailTemplateTheme>)
        : {}),
    },
    containers:
      containers.length > 0
        ? (containers as EmailTemplateContainer[])
        : fallback.containers,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } satisfies EmailTemplate;
}

function docToEmailTemplateRevision(
  id: string,
  d: FirebaseFirestore.DocumentData
): EmailTemplateRevision {
  const containers = Array.isArray(d.containers)
    ? d.containers.map(sanitizeContainer).filter(Boolean)
    : [];
  const fallback = getDefaultContactEmailTemplate();

  return {
    id,
    templateId:
      typeof d.templateId === 'string' && d.templateId.length > 0
        ? d.templateId
        : fallback.id,
    templateName:
      typeof d.templateName === 'string' ? d.templateName : fallback.name,
    subjectTemplate:
      typeof d.subjectTemplate === 'string'
        ? d.subjectTemplate
        : fallback.subjectTemplate,
    status: d.status === 'draft' ? 'draft' : 'published',
    theme: {
      ...fallback.theme,
      ...(typeof d.theme === 'object' && d.theme !== null
        ? (d.theme as Partial<EmailTemplateTheme>)
        : {}),
    },
    containers:
      containers.length > 0
        ? (containers as EmailTemplateContainer[])
        : fallback.containers,
    source: d.source === 'restore' ? 'restore' : 'save',
    restoredFromRevisionId:
      typeof d.restoredFromRevisionId === 'string'
        ? d.restoredFromRevisionId
        : undefined,
    createdAt: toDate(d.createdAt),
  } satisfies EmailTemplateRevision;
}
