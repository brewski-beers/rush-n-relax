import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  upsertEmailTemplateMock,
  restoreEmailTemplateRevisionMock,
  queueTestContactEmailMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  upsertEmailTemplateMock: vi.fn().mockResolvedValue(undefined),
  restoreEmailTemplateRevisionMock: vi.fn().mockResolvedValue(undefined),
  queueTestContactEmailMock: vi.fn().mockResolvedValue('job-id'),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories/email-template.repository', () => ({
  upsertEmailTemplate: upsertEmailTemplateMock,
  restoreEmailTemplateRevision: restoreEmailTemplateRevisionMock,
}));

vi.mock('@/lib/repositories/contact.repository', () => ({
  queueTestContactEmail: queueTestContactEmailMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  saveEmailTemplate,
  sendTestEmail,
  restoreTemplateRevision,
} from '@/app/(admin)/admin/email-templates/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

const VALID_TEMPLATE_JSON = JSON.stringify({
  id: 'contact-submission-default',
  name: 'Contact Submission Default',
  subjectTemplate: 'New contact submission from {{name}}',
  status: 'published',
  theme: {
    backgroundColor: '#0b1220',
    panelColor: '#111a2b',
    textColor: '#dce3f1',
    accentColor: '#d8c488',
    mutedTextColor: '#8fa6c8',
    borderColor: '#2a3b5f',
    fontFamily: 'sans-serif',
    borderRadiusPx: 14,
  },
  containers: [],
});

function makeSaveFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    templateJson: VALID_TEMPLATE_JSON,
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.set(key, value);
  }
  return fd;
}

function makeSendTestFormData(
  overrides: Record<string, string> = {}
): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    to: 'test@example.com',
    templateId: 'contact-submission-default',
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.set(key, value);
  }
  return fd;
}

function makeRestoreFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    revisionId: 'rev-abc123',
    templateId: 'contact-submission-default',
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.set(key, value);
  }
  return fd;
}

// ── saveEmailTemplate ─────────────────────────────────────────────────────

describe('saveEmailTemplate server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given missing templateJson', () => {
    it('returns a required-payload error', async () => {
      stubAuthorisedActor();

      const result = await saveEmailTemplate(
        null,
        makeSaveFormData({ templateJson: '' })
      );

      expect(result).toEqual({ error: 'Template payload is required.' });
      expect(upsertEmailTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe('given an invalid status enum in the JSON', () => {
    it('returns a template-invalid error', async () => {
      stubAuthorisedActor();

      const badJson = JSON.stringify({
        id: 'contact-submission-default',
        name: 'Test',
        subjectTemplate: 'Hello',
        status: 'invalid-status',
        theme: {},
        containers: [],
      });

      const result = await saveEmailTemplate(
        null,
        makeSaveFormData({ templateJson: badJson })
      );

      expect(result).toEqual({ error: 'Template payload is invalid.' });
      expect(upsertEmailTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe('given an invalid (too short) template id', () => {
    it('returns a template-invalid error', async () => {
      stubAuthorisedActor();

      const badJson = JSON.stringify({
        id: 'ab', // less than 3 chars
        name: 'Test',
        subjectTemplate: 'Hello',
        status: 'published',
        theme: {},
        containers: [],
      });

      const result = await saveEmailTemplate(
        null,
        makeSaveFormData({ templateJson: badJson })
      );

      expect(result).toEqual({ error: 'Template payload is invalid.' });
    });
  });

  describe('given a valid payload', () => {
    it('calls upsertEmailTemplate and returns success', async () => {
      stubAuthorisedActor();

      const result = await saveEmailTemplate(null, makeSaveFormData());

      expect(upsertEmailTemplateMock).toHaveBeenCalledOnce();
      expect(result).toEqual({ success: 'Template saved.' });
    });

    it('revalidates /admin/email-templates', async () => {
      stubAuthorisedActor();

      await saveEmailTemplate(null, makeSaveFormData());

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/email-templates');
    });
  });
});

// ── sendTestEmail ─────────────────────────────────────────────────────────

describe('sendTestEmail server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a malformed email address', () => {
    it('returns an invalid-email error', async () => {
      stubAuthorisedActor();

      const result = await sendTestEmail(
        null,
        makeSendTestFormData({ to: 'not-an-email' })
      );

      expect(result).toEqual({ error: 'Enter a valid test recipient email.' });
      expect(queueTestContactEmailMock).not.toHaveBeenCalled();
    });
  });

  describe('given a missing recipient address', () => {
    it('returns a required-email error', async () => {
      stubAuthorisedActor();

      const result = await sendTestEmail(
        null,
        makeSendTestFormData({ to: '' })
      );

      expect(result).toEqual({ error: 'Test recipient email is required.' });
      expect(queueTestContactEmailMock).not.toHaveBeenCalled();
    });
  });

  describe('given a valid email address', () => {
    it('calls queueTestContactEmail and returns success', async () => {
      stubAuthorisedActor();

      const result = await sendTestEmail(null, makeSendTestFormData());

      expect(queueTestContactEmailMock).toHaveBeenCalledOnce();
      expect(result.success).toContain('test@example.com');
    });
  });
});

// ── restoreTemplateRevision ───────────────────────────────────────────────

describe('restoreTemplateRevision server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given missing revisionId', () => {
    it('returns a required-revision-id error', async () => {
      stubAuthorisedActor();

      const result = await restoreTemplateRevision(
        null,
        makeRestoreFormData({ revisionId: '' })
      );

      expect(result).toEqual({ error: 'Revision ID is required.' });
      expect(restoreEmailTemplateRevisionMock).not.toHaveBeenCalled();
    });
  });

  describe('given missing templateId', () => {
    it('returns a required-template-id error', async () => {
      stubAuthorisedActor();

      const result = await restoreTemplateRevision(
        null,
        makeRestoreFormData({ templateId: '' })
      );

      expect(result).toEqual({ error: 'Template ID is required.' });
      expect(restoreEmailTemplateRevisionMock).not.toHaveBeenCalled();
    });
  });

  describe('given a valid revision and template ID', () => {
    it('calls restoreEmailTemplateRevision with correct arguments and returns success', async () => {
      stubAuthorisedActor();

      const result = await restoreTemplateRevision(null, makeRestoreFormData());

      expect(restoreEmailTemplateRevisionMock).toHaveBeenCalledOnce();
      expect(restoreEmailTemplateRevisionMock).toHaveBeenCalledWith(
        'contact-submission-default',
        'rev-abc123'
      );
      expect(result).toEqual({
        success: 'Revision restored to the live template.',
      });
    });

    it('revalidates /admin/email-templates', async () => {
      stubAuthorisedActor();

      await restoreTemplateRevision(null, makeRestoreFormData());

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/email-templates');
    });
  });

  describe('given restoreEmailTemplateRevision throws', () => {
    it('returns the error message', async () => {
      stubAuthorisedActor();
      restoreEmailTemplateRevisionMock.mockRejectedValue(
        new Error('Revision not found.')
      );

      const result = await restoreTemplateRevision(null, makeRestoreFormData());

      expect(result).toEqual({ error: 'Revision not found.' });
    });
  });
});
