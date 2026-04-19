/**
 * Vendor repository — all Firestore access for vendor documents.
 * Server-side only (uses firebase-admin).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { Vendor, VendorSummary } from '@/types';
import type { PageResult } from './types';

// ── Collection helpers ────────────────────────────────────────────────────

function vendorsCol() {
  return getAdminFirestore().collection('vendors');
}

// ── Pagination helpers ────────────────────────────────────────────────────

async function resolveCursor(
  cursor: string | undefined
): Promise<FirebaseFirestore.DocumentSnapshot | undefined> {
  if (!cursor) return undefined;
  const snap = await vendorsCol().doc(cursor).get();
  return snap.exists ? snap : undefined;
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all active vendors, ordered by name.
 * Default limit: 25 (storefront context).
 */
export async function listVendors(
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<VendorSummary>> {
  const limit = opts.limit ?? 25;
  let query = vendorsCol()
    .where('isActive', '==', true)
    .orderBy('name')
    .limit(limit);

  const afterSnap = await resolveCursor(opts.cursor);
  if (afterSnap) query = query.startAfter(afterSnap);

  const snap = await query.get();
  const items = snap.docs.map(doc => docToVendorSummary(doc.id, doc.data()));
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * List all vendors regardless of active status — admin use only.
 * Default limit: 50 (admin context).
 */
export async function listAllVendors(
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<VendorSummary>> {
  const limit = opts.limit ?? 50;
  let query = vendorsCol()
    .orderBy('name')
    .limit(limit);

  const afterSnap = await resolveCursor(opts.cursor);
  if (afterSnap) query = query.startAfter(afterSnap);

  const snap = await query.get();
  const items = snap.docs.map(doc => docToVendorSummary(doc.id, doc.data()));
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * Fetch a single vendor by slug.
 * Returns null if not found.
 */
export async function getVendorBySlug(slug: string): Promise<Vendor | null> {
  const doc = await vendorsCol().doc(slug).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  return docToVendor(doc.id, data);
}

// ── Write operations ──────────────────────────────────────────────────────

/**
 * Create or update a vendor document.
 * Uses `set({ merge: true })` so createdAt is preserved on update.
 */
export async function upsertVendor(
  data: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = vendorsCol();
  const existing = await col.doc(data.slug).get();
  const now = FieldValue.serverTimestamp();

  if (existing.exists) {
    await col
      .doc(data.slug)
      .set({ ...stripUndefinedFields(data), updatedAt: now }, { merge: true });
  } else {
    await col.doc(data.slug).set({
      ...stripUndefinedFields(data),
      createdAt: now,
      updatedAt: now,
    });
  }

  return data.slug;
}

/**
 * Toggle the isActive flag on a vendor document.
 */
export async function setVendorActive(
  slug: string,
  isActive: boolean
): Promise<void> {
  const docRef = vendorsCol().doc(slug);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new Error(`Vendor '${slug}' not found`);
  }
  await docRef.update({ isActive, updatedAt: FieldValue.serverTimestamp() });
}

// ── Private helpers ───────────────────────────────────────────────────────

function docToVendorSummary(
  id: string,
  d: FirebaseFirestore.DocumentData
): VendorSummary {
  return {
    id,
    slug: d.slug,
    name: d.name,
    categories: Array.isArray(d.categories) ? d.categories : [],
    descriptionSource: d.descriptionSource ?? undefined,
    isActive: d.isActive ?? false,
  } satisfies VendorSummary;
}

function docToVendor(id: string, d: FirebaseFirestore.DocumentData): Vendor {
  return {
    id,
    slug: d.slug,
    name: d.name,
    website: d.website ?? undefined,
    logoUrl: d.logoUrl ?? undefined,
    description: d.description ?? undefined,
    descriptionSource: d.descriptionSource ?? undefined,
    notes: d.notes ?? undefined,
    categories: Array.isArray(d.categories) ? d.categories : [],
    isActive: d.isActive ?? false,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } satisfies Vendor;
}

function stripUndefinedFields<T extends Record<string, unknown>>(
  value: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
