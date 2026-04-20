import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  revalidatePathMock,
  fileSaveMock,
  fileExistsMock,
  fileCopyMock,
  fileSetMetadataMock,
  fileDeleteMock,
  fileMock,
  bucketMock,
  getAdminStorageMock,
} = vi.hoisted(() => {
  const fileSaveMock = vi.fn().mockResolvedValue(undefined);
  const fileExistsMock = vi.fn().mockResolvedValue([true]);
  const fileCopyMock = vi.fn().mockResolvedValue(undefined);
  const fileSetMetadataMock = vi.fn().mockResolvedValue(undefined);
  const fileDeleteMock = vi.fn().mockResolvedValue(undefined);

  // Each call to bucket.file() returns a new object pointing at the mocks
  const fileMock = vi.fn(() => ({
    save: fileSaveMock,
    exists: fileExistsMock,
    copy: fileCopyMock,
    setMetadata: fileSetMetadataMock,
    delete: fileDeleteMock,
  }));

  const bucketMock = vi.fn(() => ({ file: fileMock }));
  const getAdminStorageMock = vi.fn(() => ({ bucket: bucketMock }));

  return {
    requireRoleMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    fileSaveMock,
    fileExistsMock,
    fileCopyMock,
    fileSetMetadataMock,
    fileDeleteMock,
    fileMock,
    bucketMock,
    getAdminStorageMock,
  };
});

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('@/lib/firebase/admin', () => ({
  getAdminStorage: getAdminStorageMock,
}));

import {
  uploadCoaDocument,
  updateCoaLabel,
  deleteCoaDocument,
} from '@/app/(admin)/admin/coa/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubStaff() {
  requireRoleMock.mockResolvedValue({
    uid: 'staff-uid',
    email: 'staff@rushnrelax.com',
    role: 'staff',
  });
}

function makeFormData(fields: Record<string, string | File>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

function makePdfFile(
  overrides: { type?: string; size?: number; name?: string } = {}
): File {
  const { type = 'application/pdf', name = 'test.pdf' } = overrides;
  const size = overrides.size ?? 100;
  const content = new Uint8Array(size);
  const file = new File([content], name, { type });
  // jsdom's File may lack arrayBuffer(); polyfill it to return the same bytes
  if (typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polyfilling jsdom gap
    (file as any).arrayBuffer = () => Promise.resolve(content.buffer);
  }
  return file;
}

// ── uploadCoaDocument ──────────────────────────────────────────────────────

describe('uploadCoaDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubStaff();
  });

  describe('given no file in the form', () => {
    it('returns error: A PDF file is required.', async () => {
      const result = await uploadCoaDocument(null, makeFormData({}));
      expect(result).toEqual({ error: 'A PDF file is required.' });
      expect(fileSaveMock).not.toHaveBeenCalled();
    });
  });

  describe('given a file with the wrong MIME type', () => {
    it('returns error: Only PDF files are accepted.', async () => {
      const badFile = makePdfFile({ type: 'image/png', name: 'coa.png' });
      const result = await uploadCoaDocument(
        null,
        makeFormData({ file: badFile })
      );
      expect(result).toEqual({ error: 'Only PDF files are accepted.' });
      expect(fileSaveMock).not.toHaveBeenCalled();
    });
  });

  describe('given a file that exceeds 20 MB', () => {
    it('returns error: File must be 20 MB or smaller.', async () => {
      const bigFile = makePdfFile({ size: 21 * 1024 * 1024 });
      const result = await uploadCoaDocument(
        null,
        makeFormData({ file: bigFile })
      );
      expect(result).toEqual({ error: 'File must be 20 MB or smaller.' });
      expect(fileSaveMock).not.toHaveBeenCalled();
    });
  });

  describe('given a valid PDF file', () => {
    it('calls bucket.file().save() under the COA/ prefix', async () => {
      const pdfFile = makePdfFile({ name: 'my coa.pdf' });
      const result = await uploadCoaDocument(
        null,
        makeFormData({ file: pdfFile })
      );

      expect(result).toEqual({});
      expect(fileMock).toHaveBeenCalledWith('COA/my_coa.pdf');
      expect(fileSaveMock).toHaveBeenCalledOnce();
      const [, opts] = fileSaveMock.mock.calls[0] as [
        unknown,
        { metadata: { contentType: string } },
      ];
      expect(opts.metadata.contentType).toBe('application/pdf');
    });

    it('revalidates /admin/coa', async () => {
      const pdfFile = makePdfFile();
      await uploadCoaDocument(null, makeFormData({ file: pdfFile }));
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/coa');
    });
  });
});

// ── updateCoaLabel ─────────────────────────────────────────────────────────

describe('updateCoaLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubStaff();
    fileExistsMock.mockResolvedValue([true]);
  });

  describe('given an invalid name (not starting with COA/)', () => {
    it('returns error: Invalid document name.', async () => {
      const result = await updateCoaLabel(
        null,
        makeFormData({ name: 'uploads/other.pdf', label: 'Test' })
      );
      expect(result).toEqual({ error: 'Invalid document name.' });
    });
  });

  describe('given a name for a document that does not exist', () => {
    it('returns error: Document not found.', async () => {
      fileExistsMock.mockResolvedValue([false]);
      const result = await updateCoaLabel(
        null,
        makeFormData({ name: 'COA/ghost.pdf', label: 'Ghost' })
      );
      expect(result).toEqual({ error: 'Document not found.' });
    });
  });

  describe('given a label that changes the filename', () => {
    it('copies the file to the new path, updates metadata, then deletes the original', async () => {
      const result = await updateCoaLabel(
        null,
        makeFormData({ name: 'COA/old.pdf', label: 'New Name' })
      );

      expect(result).toEqual({});
      // The new path is COA/New_Name.pdf
      expect(fileMock).toHaveBeenCalledWith('COA/New_Name.pdf');
      expect(fileCopyMock).toHaveBeenCalledOnce();
      expect(fileSetMetadataMock).toHaveBeenCalledOnce();
      expect(fileDeleteMock).toHaveBeenCalledOnce();
    });
  });

  describe('given a label that does not change the filename (same slug)', () => {
    it('only updates metadata without copying or deleting', async () => {
      // "same.pdf" slug → labelToFilename("same") === "same.pdf"
      const result = await updateCoaLabel(
        null,
        makeFormData({ name: 'COA/same.pdf', label: 'same' })
      );

      expect(result).toEqual({});
      expect(fileCopyMock).not.toHaveBeenCalled();
      expect(fileDeleteMock).not.toHaveBeenCalled();
      expect(fileSetMetadataMock).toHaveBeenCalledOnce();
    });
  });
});

// ── deleteCoaDocument ──────────────────────────────────────────────────────

describe('deleteCoaDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubStaff();
  });

  describe('given a valid COA/ document name', () => {
    it('calls bucket.file().delete({ ignoreNotFound: true })', async () => {
      await deleteCoaDocument(makeFormData({ name: 'COA/my_coa.pdf' }));

      expect(fileMock).toHaveBeenCalledWith('COA/my_coa.pdf');
      expect(fileDeleteMock).toHaveBeenCalledWith({ ignoreNotFound: true });
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/coa');
    });
  });

  describe('given an invalid document name', () => {
    it('returns without calling delete', async () => {
      await deleteCoaDocument(makeFormData({ name: 'uploads/other.pdf' }));
      expect(fileDeleteMock).not.toHaveBeenCalled();
    });
  });

  describe('given no name in the form', () => {
    it('returns without calling delete', async () => {
      await deleteCoaDocument(makeFormData({}));
      expect(fileDeleteMock).not.toHaveBeenCalled();
    });
  });
});
