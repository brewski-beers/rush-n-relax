/**
 * Vendor repository — all Firestore access for vendor documents.
 * Server-side only (uses firebase-admin).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { Vendor, VendorSummary } from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function vendorsCol() {
  return getAdminFirestore().collection('vendors');
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all active vendors, ordered by name.
 */
export async function listVendors(): Promise<VendorSummary[]> {
  const snap = await vendorsCol()
    .where('isActive', '==', true)
    .orderBy('name')
    .get();

  return snap.docs.map(doc => docToVendorSummary(doc.id, doc.data()));
}

/**
 * List all vendors regardless of active status — admin use only.
 */
export async function listAllVendors(): Promise<Vendor[]> {
  const snap = await vendorsCol().orderBy('name').get();
  return snap.docs.map(doc => docToVendor(doc.id, doc.data()));
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
 * Uses `set({ merge: true })` with `serverTimestamp()` so that:
 * - On create: both `createdAt` and `updatedAt` are set
 * - On update: only `updatedAt` is refreshed (createdAt preserved via merge)
 */
export async function upsertVendor(
  data: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = vendorsCol();
  const existing = await col.doc(data.slug).get();
  const now = FieldValue.serverTimestamp();

  const payload = stripUndefinedFields({ ...data });

  if (existing.exists) {
    await col
      .doc(data.slug)
      .set({ ...payload, updatedAt: now }, { merge: true });
  } else {
    await col
      .doc(data.slug)
      .set({ ...payload, createdAt: now, updatedAt: now });
  }

  return data.slug;
}

/**
 * Set the isActive flag on a vendor document.
 */
export async function setVendorActive(
  slug: string,
  isActive: boolean
): Promise<void> {
  await vendorsCol()
    .doc(slug)
    .update({ isActive, updatedAt: FieldValue.serverTimestamp() });
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
    descriptionSource: d.descriptionSource,
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
    descriptionSource: d.descriptionSource ?? 'custom',
    notes: d.notes ?? undefined,
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
