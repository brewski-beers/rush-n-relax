/**
 * COA repository — lists Certificate of Analysis PDFs from Firebase Storage.
 * Server-side only (uses firebase-admin).
 */
import { getAdminStorage } from '@/lib/firebase/admin';
import type { CoaDocument } from '@/types';

const COA_PREFIX = 'COA/';

/**
 * Derive a human-readable label from a Storage object name.
 * Strips the COA/ prefix and .pdf extension, replaces hyphens/underscores
 * with spaces, and title-cases the result.
 */
function labelFromFilename(objectName: string): string {
  const withoutPrefix = objectName.startsWith(COA_PREFIX)
    ? objectName.slice(COA_PREFIX.length)
    : objectName;
  const withoutExt = withoutPrefix.endsWith('.pdf')
    ? withoutPrefix.slice(0, -4)
    : withoutPrefix;
  const spaced = withoutExt.replace(/[-_]+/g, ' ');
  return spaced
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * List all COA PDF documents from the COA/ prefix in Storage.
 * Returns CoaDocument[] sorted by updatedAt descending (newest first).
 * Returns [] if no files exist — never throws.
 */
export async function listCoaDocuments(): Promise<CoaDocument[]> {
  try {
    const bucket = getAdminStorage().bucket();
    const [files] = await bucket.getFiles({
      prefix: COA_PREFIX,
      autoPaginate: true,
    });

    const pdfFiles = files.filter(
      file =>
        file.name !== COA_PREFIX && // exclude the folder placeholder if it exists
        file.name.endsWith('.pdf')
    );

    if (pdfFiles.length === 0) return [];

    const docs = await Promise.all(
      pdfFiles.map(async (file): Promise<CoaDocument> => {
        const [signedUrlResult] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000, // 1-hour TTL
        });

        // Use custom metadata label if set, otherwise derive from filename
        const customLabel = file.metadata?.metadata?.label as
          | string
          | undefined;
        const label = customLabel ?? labelFromFilename(file.name);

        const size = file.metadata?.size ? Number(file.metadata.size) : 0;

        const updatedAtRaw = file.metadata?.updated;
        const updatedAt = updatedAtRaw ? new Date(updatedAtRaw) : new Date(0);

        return {
          name: file.name,
          label,
          downloadUrl: signedUrlResult,
          size,
          updatedAt,
        } satisfies CoaDocument;
      })
    );

    // Sort alphabetically by label
    docs.sort((a, b) => a.label.localeCompare(b.label));

    return docs;
  } catch {
    // Return empty array on any Storage error so callers don't break
    return [];
  }
}
