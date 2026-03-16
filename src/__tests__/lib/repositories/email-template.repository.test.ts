import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  whereMock,
  orderByMock,
  limitMock,
  getMock,
  docGetMock,
  batchSetMock,
  batchCommitMock,
  collectionMock,
  getAdminFirestoreMock,
  createIdMock,
} = vi.hoisted(() => {
  const getMock = vi.fn().mockResolvedValue({ docs: [] });
  const limitMock = vi.fn().mockReturnValue({ get: getMock });
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
  const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });

  // Shared doc-level get mock so tests can control per-doc responses
  const docGetMock = vi.fn().mockResolvedValue({
    exists: false,
    id: 'doc-id',
    data: () => ({}),
  });

  const batchSetMock = vi.fn();
  const batchCommitMock = vi.fn().mockResolvedValue(undefined);

  const collectionMock = vi.fn(() => ({
    doc: vi.fn((name?: string) => ({
      id: name ?? 'doc-id',
      get: docGetMock,
      set: vi.fn().mockResolvedValue(undefined),
    })),
    where: whereMock,
    orderBy: vi.fn().mockReturnValue({ get: getMock }),
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
    batch: vi.fn(() => ({
      set: batchSetMock,
      commit: batchCommitMock,
    })),
  }));

  const createIdMock = vi.fn((prefix: string) => `${prefix}-mocked`);

  return {
    whereMock,
    orderByMock,
    limitMock,
    getMock,
    docGetMock,
    batchSetMock,
    batchCommitMock,
    collectionMock,
    getAdminFirestoreMock,
    createIdMock,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (value: Date | string) => new Date(value),
}));

vi.mock('@/lib/utils/id', () => ({
  createId: createIdMock,
}));

import {
  listEmailTemplateRevisions,
  upsertEmailTemplate,
  getEmailTemplateById,
  restoreEmailTemplateRevision,
} from '@/lib/repositories/email-template.repository';

describe('email-template.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listEmailTemplateRevisions', () => {
    it('delegates ordering and limit to Firestore instead of doing it in memory', async () => {
      const now = new Date();
      getMock.mockResolvedValueOnce({
        docs: [
          {
            id: 'rev-1',
            data: () => ({
              templateId: 'contact-submission-default',
              templateName: 'Contact Submission Default',
              subjectTemplate: 'New contact submission from {{name}}',
              status: 'published',
              theme: {},
              containers: [],
              source: 'save',
              createdAt: now.toISOString(),
            }),
          },
        ],
      });

      const results = await listEmailTemplateRevisions(
        'contact-submission-default',
        5
      );

      expect(collectionMock).toHaveBeenCalledWith('email-template-revisions');
      expect(whereMock).toHaveBeenCalledWith(
        'templateId',
        '==',
        'contact-submission-default'
      );
      expect(orderByMock).toHaveBeenCalledWith('createdAt', 'desc');
      expect(limitMock).toHaveBeenCalledWith(5);
      expect(getMock).toHaveBeenCalledTimes(1);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('rev-1');
    });

    it('returns empty array when no revisions exist', async () => {
      getMock.mockResolvedValueOnce({ docs: [] });

      const results = await listEmailTemplateRevisions(
        'contact-submission-default'
      );

      expect(results).toEqual([]);
    });

    it('uses the default limit of 12 when none is provided', async () => {
      getMock.mockResolvedValueOnce({ docs: [] });

      await listEmailTemplateRevisions('contact-submission-default');

      expect(limitMock).toHaveBeenCalledWith(12);
    });
  });

  // ── upsertEmailTemplate ──────────────────────────────────────────────────

  describe('upsertEmailTemplate', () => {
    it('writes to the templates collection and appends a revision via batch', async () => {
      // The template doc does not exist yet (new template)
      docGetMock.mockResolvedValue({
        exists: false,
        id: 'contact-submission-default',
        data: () => ({}),
      });

      await upsertEmailTemplate({
        id: 'contact-submission-default',
        name: 'Contact Submission Default',
        subjectTemplate: 'New submission from {{name}}',
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

      // batch.commit() must be called once
      expect(batchCommitMock).toHaveBeenCalledOnce();

      // batch.set() is called twice: once for template, once for revision
      expect(batchSetMock).toHaveBeenCalledTimes(2);
    });

    it('uses the existing createdAt when the template document already exists', async () => {
      const existingCreatedAt = new Date('2024-01-01').toISOString();
      docGetMock.mockResolvedValue({
        exists: true,
        id: 'contact-submission-default',
        data: () => ({ createdAt: existingCreatedAt }),
      });

      await upsertEmailTemplate({
        id: 'contact-submission-default',
        name: 'Contact Submission Default',
        subjectTemplate: 'Hello',
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

      // The first batch.set() call carries the template document
      const [, templatePayload] = batchSetMock.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      // createdAt should be the existing date, not now
      expect((templatePayload.createdAt as Date).toISOString()).toBe(
        existingCreatedAt
      );
    });
  });

  // ── getEmailTemplateById ─────────────────────────────────────────────────

  describe('getEmailTemplateById', () => {
    it('returns the default template when the document does not exist', async () => {
      docGetMock.mockResolvedValue({
        exists: false,
        id: 'contact-submission-default',
        data: () => ({}),
      });

      const result = await getEmailTemplateById('contact-submission-default');

      expect(result.id).toBe('contact-submission-default');
      expect(result.status).toBe('published');
    });

    it('returns the stored template when the document exists', async () => {
      docGetMock.mockResolvedValue({
        exists: true,
        id: 'contact-submission-default',
        data: () => ({
          name: 'Custom Template',
          subjectTemplate: 'Custom subject',
          status: 'draft',
          theme: {},
          containers: [],
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-06-01').toISOString(),
        }),
      });

      const result = await getEmailTemplateById('contact-submission-default');

      expect(result.name).toBe('Custom Template');
      expect(result.status).toBe('draft');
    });
  });

  // ── restoreEmailTemplateRevision ─────────────────────────────────────────

  describe('restoreEmailTemplateRevision', () => {
    it('throws when the revision document does not exist', async () => {
      docGetMock.mockResolvedValue({
        exists: false,
        id: 'rev-missing',
        data: () => ({}),
      });

      await expect(
        restoreEmailTemplateRevision(
          'contact-submission-default',
          'rev-missing'
        )
      ).rejects.toThrow('Revision not found.');

      expect(batchCommitMock).not.toHaveBeenCalled();
    });

    it('throws when the revision belongs to a different template', async () => {
      docGetMock.mockResolvedValue({
        exists: true,
        id: 'rev-abc',
        data: () => ({
          templateId: 'other-template',
          templateName: 'Other Template',
          subjectTemplate: 'Hello',
          status: 'published',
          theme: {},
          containers: [],
          source: 'save',
          createdAt: new Date().toISOString(),
        }),
      });

      await expect(
        restoreEmailTemplateRevision('contact-submission-default', 'rev-abc')
      ).rejects.toThrow('Revision does not belong to this template.');
    });

    it('calls batch.commit when revision matches the template', async () => {
      // First docGetMock call: the revision doc
      // Second docGetMock call: the existing template doc (for createdAt)
      docGetMock
        .mockResolvedValueOnce({
          exists: true,
          id: 'rev-good',
          data: () => ({
            templateId: 'contact-submission-default',
            templateName: 'Contact Submission Default',
            subjectTemplate: 'Restored subject',
            status: 'published',
            theme: {},
            containers: [],
            source: 'save',
            createdAt: new Date().toISOString(),
          }),
        })
        .mockResolvedValue({
          exists: false,
          id: 'contact-submission-default',
          data: () => ({}),
        });

      await restoreEmailTemplateRevision(
        'contact-submission-default',
        'rev-good'
      );

      expect(batchCommitMock).toHaveBeenCalledOnce();
    });
  });
});
