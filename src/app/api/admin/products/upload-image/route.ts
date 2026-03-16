/**
 * POST /api/admin/products/upload-image
 * Requires 'owner' role (verified via session cookie).
 *
 * FormData fields:
 *   file: File  — the image to upload
 *   slug: string — product doc ID
 *   slot: 'featured' | '0'–'4'
 *
 * Storage paths:
 *   featured → products/{slug}/featured.{ext}
 *   gallery  → products/{slug}/gallery/{n}.{ext}
 *
 * Returns: { path: string }
 */
import { requireRole } from '@/lib/admin-auth';
import { getAdminStorage } from '@/lib/firebase/admin';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  return 'webp';
}

export async function POST(request: Request): Promise<Response> {
  await requireRole('owner');

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  const file = formData.get('file');
  // Extract string fields safely — FormData.get() may return a File object,
  // so we check the type before calling string methods to avoid [object File].
  const slugRaw = formData.get('slug');
  const slotRaw = formData.get('slot');
  const slug = typeof slugRaw === 'string' ? slugRaw.trim() : undefined;
  const slot = typeof slotRaw === 'string' ? slotRaw.trim() : undefined;

  if (!(file instanceof File)) {
    return Response.json({ error: 'file is required.' }, { status: 400 });
  }
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ error: 'Invalid slug.' }, { status: 400 });
  }
  if (!slot || !['featured', '0', '1', '2', '3', '4'].includes(slot)) {
    return Response.json({ error: 'Invalid slot.' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return Response.json(
      { error: 'Only JPEG, PNG, or WebP images are allowed.' },
      { status: 422 }
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: 'File exceeds the 5 MB limit.' },
      { status: 422 }
    );
  }

  const ext = extFromMime(file.type);
  const storagePath =
    slot === 'featured'
      ? `products/${slug}/featured.${ext}`
      : `products/${slug}/gallery/${slot}.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await getAdminStorage()
      .bucket()
      .file(storagePath)
      .save(buffer, { metadata: { contentType: file.type } });
  } catch (err) {
    console.error('[upload-image] Storage write failed:', err);
    return Response.json({ error: 'Upload failed.' }, { status: 500 });
  }

  return Response.json({ path: storagePath });
}
