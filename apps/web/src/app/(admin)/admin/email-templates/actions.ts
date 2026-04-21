'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { queueTestContactEmail } from '@/lib/repositories/contact.repository';
import {
  restoreEmailTemplateRevision,
  upsertEmailTemplate,
} from '@/lib/repositories/email-template.repository';
import type { EmailTemplate } from '@/types';

interface ActionState {
  error?: string;
  success?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseTemplate(json: string): EmailTemplate | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!isPlainObject(parsed)) {
      return null;
    }

    const id = parsed.id;
    const name = parsed.name;
    const subjectTemplate = parsed.subjectTemplate;
    const status = parsed.status;
    const theme = parsed.theme;
    const containers = parsed.containers;

    if (
      typeof id !== 'string' ||
      id.length < 3 ||
      typeof name !== 'string' ||
      typeof subjectTemplate !== 'string' ||
      (status !== 'draft' && status !== 'published') ||
      !isPlainObject(theme) ||
      !Array.isArray(containers)
    ) {
      return null;
    }

    return {
      id,
      name,
      subjectTemplate,
      status,
      theme: {
        backgroundColor:
          typeof theme.backgroundColor === 'string'
            ? theme.backgroundColor
            : '#0b1220',
        panelColor:
          typeof theme.panelColor === 'string' ? theme.panelColor : '#111a2b',
        textColor:
          typeof theme.textColor === 'string' ? theme.textColor : '#dce3f1',
        accentColor:
          typeof theme.accentColor === 'string' ? theme.accentColor : '#d8c488',
        mutedTextColor:
          typeof theme.mutedTextColor === 'string'
            ? theme.mutedTextColor
            : '#8fa6c8',
        borderColor:
          typeof theme.borderColor === 'string' ? theme.borderColor : '#2a3b5f',
        fontFamily:
          typeof theme.fontFamily === 'string'
            ? theme.fontFamily
            : "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        borderRadiusPx:
          typeof theme.borderRadiusPx === 'number' ? theme.borderRadiusPx : 14,
      },
      containers: containers as EmailTemplate['containers'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch {
    return null;
  }
}

export async function saveEmailTemplate(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireRole('owner');

  const templateJson = formData.get('templateJson')?.toString();
  if (!templateJson) {
    return { error: 'Template payload is required.' };
  }

  const parsed = parseTemplate(templateJson);
  if (!parsed) {
    return { error: 'Template payload is invalid.' };
  }

  await upsertEmailTemplate({
    id: parsed.id,
    name: parsed.name,
    subjectTemplate: parsed.subjectTemplate,
    status: parsed.status,
    theme: parsed.theme,
    containers: parsed.containers,
  });

  revalidatePath('/admin/email-templates');
  return { success: 'Template saved.' };
}

export async function sendTestEmail(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireRole('owner');

  const to = formData.get('to')?.toString().trim().toLowerCase();
  const templateId = formData.get('templateId')?.toString().trim();
  const templateJson = formData.get('templateJson')?.toString();
  if (!to) {
    return { error: 'Test recipient email is required.' };
  }

  const parsedTemplate = templateJson ? parseTemplate(templateJson) : null;
  if (templateJson && !parsedTemplate) {
    return { error: 'Current template payload is invalid.' };
  }

  const effectiveTemplateId = parsedTemplate?.id ?? templateId;
  if (!effectiveTemplateId) {
    return { error: 'Template ID is required.' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { error: 'Enter a valid test recipient email.' };
  }

  await queueTestContactEmail({
    to,
    templateId: effectiveTemplateId,
    ...(parsedTemplate ? { template: parsedTemplate } : {}),
  });
  revalidatePath('/admin/email-templates');
  return { success: `Queued a test email to ${to}.` };
}

export async function restoreTemplateRevision(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireRole('owner');

  const revisionId = formData.get('revisionId')?.toString().trim();
  const templateId = formData.get('templateId')?.toString().trim();
  if (!revisionId) {
    return { error: 'Revision ID is required.' };
  }

  if (!templateId) {
    return { error: 'Template ID is required.' };
  }

  try {
    await restoreEmailTemplateRevision(templateId, revisionId);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Unable to restore revision.',
    };
  }

  revalidatePath('/admin/email-templates');
  return { success: 'Revision restored to the live template.' };
}
