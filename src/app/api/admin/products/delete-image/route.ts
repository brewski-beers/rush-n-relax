/**
 * DELETE /api/admin/products/delete-image
 * Requires 'owner' role (verified via session cookie).
 *
 * JSON body: { path: string }
 *
 * Validates path starts with 'products/' to prevent path traversal.
 * Returns 204 on success.
 */
import { requireRole } from '@/lib/admin-auth';
import { getAdminStorage } from '@/lib/firebase/admin';

export async function DELETE(request: Request): Promise<Response> {
  await requireRole('owner');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'body must be an object.' }, { status: 400 });
  }

  const path = (body as Record<string, unknown>).path;
  if (typeof path !== 'string' || !path.startsWith('products/')) {
    return Response.json({ error: 'Invalid path.' }, { status: 400 });
  }

  try {
    await getAdminStorage().bucket().file(path).delete();
  } catch (err) {
    console.error('[delete-image] Storage delete failed:', err);
    return Response.json({ error: 'Delete failed.' }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
