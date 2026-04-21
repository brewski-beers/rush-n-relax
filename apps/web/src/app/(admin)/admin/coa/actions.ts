'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { getAdminStorage } from '@/lib/firebase/admin';

const COA_PREFIX = 'COA/';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function uploadCoaDocument(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('staff');

  const file = formData.get('file');
  const labelInput = formData.get('label')?.toString().trim() || undefined;

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'A PDF file is required.' };
  }

  if (file.type !== 'application/pdf') {
    return { error: 'Only PDF files are accepted.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File must be 20 MB or smaller.' };
  }

  const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectName = `${COA_PREFIX}${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const bucket = getAdminStorage().bucket();
  const storageFile = bucket.file(objectName);

  const customMetadata: Record<string, string> = {};
  if (labelInput) {
    customMetadata.label = labelInput;
  }

  await storageFile.save(buffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata:
        Object.keys(customMetadata).length > 0 ? customMetadata : undefined,
    },
  });

  revalidatePath('/admin/coa');
  return {};
}

function labelToFilename(label: string): string {
  const sanitized = label
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (sanitized || 'coa') + '.pdf';
}

export async function updateCoaLabel(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('staff');

  const name = formData.get('name')?.toString();
  const label = formData.get('label')?.toString().trim() || '';

  if (!name || !name.startsWith(COA_PREFIX)) {
    return { error: 'Invalid document name.' };
  }

  const bucket = getAdminStorage().bucket();
  const src = bucket.file(name);

  const [exists] = await src.exists();
  if (!exists) return { error: 'Document not found.' };

  const newFilename = labelToFilename(label);
  const newObjectName = `${COA_PREFIX}${newFilename}`;
  const metadata: Record<string, string | null> = label
    ? { label }
    : { label: null };

  if (newObjectName !== name) {
    // Copy to new path, update metadata on destination, then delete the original
    const dest = bucket.file(newObjectName);
    await src.copy(dest);
    await dest.setMetadata({
      contentType: 'application/pdf',
      metadata,
    });
    await src.delete();
  } else {
    // Filename unchanged — just update the metadata
    await src.setMetadata({
      metadata: label ? { label } : { label: null },
    });
  }

  revalidatePath('/admin/coa');
  return {};
}

export async function deleteCoaDocument(formData: FormData): Promise<void> {
  await requireRole('staff');

  const name = formData.get('name')?.toString();
  if (!name || !name.startsWith(COA_PREFIX)) return;

  const bucket = getAdminStorage().bucket();
  await bucket.file(name).delete({ ignoreNotFound: true });

  revalidatePath('/admin/coa');
}
