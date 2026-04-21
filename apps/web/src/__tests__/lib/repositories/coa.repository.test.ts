import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { getFilesMock, getSignedUrlMock, getAdminStorageMock } = vi.hoisted(
  () => {
    const getSignedUrlMock = vi.fn();
    const getFilesMock = vi.fn();

    const getAdminStorageMock = vi.fn(() => ({
      bucket: vi.fn(() => ({
        getFiles: getFilesMock,
      })),
    }));

    return { getFilesMock, getSignedUrlMock, getAdminStorageMock };
  }
);

vi.mock('@/lib/firebase/admin', () => ({
  getAdminStorage: getAdminStorageMock,
}));

import { listCoaDocuments } from '@/lib/repositories/coa.repository';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFile(
  name: string,
  opts: {
    size?: number;
    updated?: string;
    customLabel?: string;
    signedUrl?: string;
  } = {}
) {
  const signedUrl = opts.signedUrl ?? `https://storage.example.com/${name}`;
  return {
    name,
    metadata: {
      size: String(opts.size ?? 1024),
      updated: opts.updated ?? '2024-01-15T00:00:00.000Z',
      metadata: opts.customLabel ? { label: opts.customLabel } : undefined,
    },
    getSignedUrl: vi.fn().mockResolvedValue([signedUrl]),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('coa.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listCoaDocuments', () => {
    it('Given the Storage prefix contains .pdf files, returns sorted CoaDocument[]', async () => {
      const older = makeFile('COA/og-kush-2023-01.pdf', {
        updated: '2023-06-01T00:00:00.000Z',
        size: 512,
      });
      const newer = makeFile('COA/blue-dream-2024-01.pdf', {
        updated: '2024-01-15T00:00:00.000Z',
        size: 2048,
      });

      getFilesMock.mockResolvedValue([[older, newer]]);

      const docs = await listCoaDocuments();

      expect(docs).toHaveLength(2);
      // Sorted newest first
      expect(docs[0].name).toBe('COA/blue-dream-2024-01.pdf');
      expect(docs[1].name).toBe('COA/og-kush-2023-01.pdf');
      expect(docs[0].size).toBe(2048);
      expect(docs[0].downloadUrl).toContain('blue-dream-2024-01');
    });

    it('Given the Storage prefix is empty, returns []', async () => {
      getFilesMock.mockResolvedValue([[]]);

      const docs = await listCoaDocuments();

      expect(docs).toEqual([]);
    });

    it('Given Storage returns non-pdf files, they are excluded from results', async () => {
      const pdf = makeFile('COA/lab-report.pdf');
      const img = makeFile('COA/thumbnail.jpg');
      const placeholder = makeFile('COA/'); // folder placeholder

      getFilesMock.mockResolvedValue([[pdf, img, placeholder]]);

      const docs = await listCoaDocuments();

      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe('COA/lab-report.pdf');
    });

    it('Given a filename with no custom metadata, derives label from filename', async () => {
      const file = makeFile('COA/blue-dream-2024-01.pdf', {
        updated: '2024-01-15T00:00:00.000Z',
      });

      getFilesMock.mockResolvedValue([[file]]);

      const [doc] = await listCoaDocuments();

      expect(doc.label).toBe('Blue Dream 2024 01');
    });

    it('Given a file has metadata.metadata.label, label uses the custom metadata value', async () => {
      const file = makeFile('COA/blue-dream-2024-01.pdf', {
        customLabel: 'Blue Dream — Batch 3',
        updated: '2024-01-15T00:00:00.000Z',
      });

      getFilesMock.mockResolvedValue([[file]]);

      const [doc] = await listCoaDocuments();

      expect(doc.label).toBe('Blue Dream — Batch 3');
    });
  });
});
