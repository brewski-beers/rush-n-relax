export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import {
  getDefaultContactEmailTemplate,
  getEmailTemplateById,
  listEmailTemplates,
  listEmailTemplateRevisions,
} from '@/lib/repositories/email-template.repository';
import type { EmailTemplate, EmailTemplateRevision } from '@/types';
import { EmailTemplateEditor } from './EmailTemplateEditor';
import { EmailTemplateRevisionHistory } from './EmailTemplateRevisionHistory';

const DEFAULT_TEMPLATE_ID = 'contact-submission-default';

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeTemplateId(value: string | undefined): string {
  if (!value) {
    return DEFAULT_TEMPLATE_ID;
  }

  return /^[a-z0-9-]{3,64}$/.test(value) ? value : DEFAULT_TEMPLATE_ID;
}

export default async function AdminEmailTemplatesPage({
  searchParams,
}: PageProps) {
  await requireRole('owner');
  const params = (await searchParams) ?? {};
  const templateIdRaw = params.templateId;
  const templateId = normalizeTemplateId(
    Array.isArray(templateIdRaw) ? templateIdRaw[0] : templateIdRaw
  );

  let templates: EmailTemplate[];
  let template: EmailTemplate;
  let revisions: EmailTemplateRevision[];

  try {
    [templates, template, revisions] = await Promise.all([
      listEmailTemplates(),
      getEmailTemplateById(templateId),
      listEmailTemplateRevisions(templateId),
    ]);
  } catch (error) {
    console.error(
      '[admin/email-templates] failed to load template data',
      error
    );
    const fallback = getDefaultContactEmailTemplate();
    templates = [fallback];
    template = fallback;
    revisions = [];
  }

  const templateOptions = templates.some(option => option.id === template.id)
    ? templates
    : [template, ...templates];

  return (
    <>
      <div className="admin-page-header">
        <h1>Email Templates</h1>
      </div>
      <p className="admin-section-desc">
        Build and preview transactional emails with drag-and-drop containers,
        live text editing, and theme controls.
      </p>

      <form
        method="get"
        className="admin-inline-form admin-template-select-form"
      >
        <label htmlFor="templateId">Load Template</label>
        <select id="templateId" name="templateId" defaultValue={template.id}>
          {templateOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.name} ({option.id})
            </option>
          ))}
        </select>
        <button type="submit" className="admin-btn-secondary">
          Load
        </button>
      </form>

      <EmailTemplateEditor initialTemplate={template} />
      <EmailTemplateRevisionHistory
        templateId={template.id}
        revisions={revisions}
      />
    </>
  );
}
