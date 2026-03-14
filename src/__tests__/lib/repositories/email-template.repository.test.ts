import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  whereMock,
  orderByMock,
  limitMock,
  getMock,
  collectionMock,
  getAdminFirestoreMock,
  createIdMock,
} = vi.hoisted(() => {
  const getMock = vi.fn().mockResolvedValue({ docs: [] });
  const limitMock = vi.fn().mockReturnValue({ get: getMock });
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
  const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });

  const collectionMock = vi.fn(() => ({
    doc: vi.fn((name?: string) => ({
      id: name ?? 'doc-id',
      get: vi
        .fn()
        .mockResolvedValue({
          exists: false,
          id: name ?? 'doc-id',
          data: () => ({}),
        }),
    })),
    where: whereMock,
    orderBy: vi.fn().mockReturnValue({ get: getMock }),
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
    batch: vi.fn(() => ({
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
  }));

  const createIdMock = vi.fn((prefix: string) => `${prefix}-mocked`);

  return {
    whereMock,
    orderByMock,
    limitMock,
    getMock,
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

import { listEmailTemplateRevisions } from '@/lib/repositories/email-template.repository';

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
});
