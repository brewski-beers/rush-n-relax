/**
 * POST /api/admin/coa/upload
 * Requires 'staff' role (verified via session cookie).
 *
 * FormData fields:
 *   file: File — the PDF to upload
 *
 * Storage path: COA/{original-filename}
 *
 * Returns: { path: string, url: string }
 *   path — Storage object name (e.g. "COA/Black-Dolphin.pdf")
 *   url  — signed URL valid for 7 days (stored as coaUrl in Firestore)
 */
import { requireRole } from '@/lib/admin-auth';
import { getAdminStorage } from '@/lib/firebase/admin';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request): Promise<Response> {
  await requireRole('staff');

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'file is required.' }, { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return Response.json(
      { error: 'Only PDF files are accepted.' },
      { status: 422 }
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: 'File exceeds the 10 MB limit.' },
      { status: 422 }
    );
  }

  // Sanitize filename — keep alphanumeric, hyphens, underscores, dots
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const storagePath = `COA/${safeName}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const storageFile = getAdminStorage().bucket().file(storagePath);

    await storageFile.save(buffer, {
      metadata: { contentType: 'application/pdf' },
    });

    const [signedUrl] = await storageFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return Response.json({ path: storagePath, url: signedUrl });
  } catch (err) {
    console.error('[coa/upload] Storage write failed:', err);
    return Response.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
