/**
 * Location repository — all Firestore access for location documents.
 * Server-side only (uses firebase-admin). UI code calls these from Server Components.
 *
 * Multi-tenant: every query is scoped to a tenantId.
 * Phase 1: tenantId defaults to DEFAULT_TENANT_ID ('rnr').
 */
import {
  getAdminFirestore,
  toDate,
  DEFAULT_TENANT_ID,
} from '@/lib/firebase/admin';
import type { Location, LocationSummary } from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function locationsCol(tenantId: string = DEFAULT_TENANT_ID) {
  return getAdminFirestore().collection(`tenants/${tenantId}/locations`);
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all locations for a tenant, ordered by name.
 * Returns lightweight summaries — use getLocationBySlug for full detail.
 */
export async function listLocations(
  tenantId: string = DEFAULT_TENANT_ID
): Promise<LocationSummary[]> {
  const snap = await locationsCol(tenantId).orderBy('name').get();
  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      slug: d.slug,
      name: d.name,
      address: d.address,
      city: d.city,
      state: d.state,
      zip: d.zip,
      phone: d.phone,
      hours: d.hours,
      placeId: d.placeId,
      coordinates: d.coordinates ?? undefined,
    } satisfies LocationSummary;
  });
}

/**
 * Fetch a single location by slug.
 * Returns null if not found (caller decides whether to notFound()).
 */
export async function getLocationBySlug(
  slug: string,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<Location | null> {
  const snap = await locationsCol(tenantId)
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return docToLocation(doc.id, doc.data());
}

/**
 * Fetch a single location by Firestore document ID.
 */
export async function getLocationById(
  id: string,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<Location | null> {
  const doc = await locationsCol(tenantId).doc(id).get();
  if (!doc.exists) return null;
  return docToLocation(doc.id, doc.data()!);
}

// ── Write operations ──────────────────────────────────────────────────────

/**
 * Upsert a location document (admin use only).
 * Creates if ID is absent, merges if ID is present.
 */
export async function upsertLocation(
  data: Omit<Location, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  tenantId: string = DEFAULT_TENANT_ID
): Promise<string> {
  const col = locationsCol(tenantId);
  const now = new Date();

  if (data.id) {
    await col.doc(data.id).set({ ...data, updatedAt: now }, { merge: true });
    return data.id;
  }

  const ref = await col.add({ ...data, createdAt: now, updatedAt: now });
  return ref.id;
}

// ── Private helpers ───────────────────────────────────────────────────────

function docToLocation(
  id: string,
  d: FirebaseFirestore.DocumentData
): Location {
  return {
    id,
    tenantId: d.tenantId,
    slug: d.slug,
    name: d.name,
    address: d.address,
    city: d.city,
    state: d.state,
    zip: d.zip,
    phone: d.phone,
    hours: d.hours,
    description: d.description ?? '',
    coordinates: d.coordinates ?? undefined,
    socialLinkIds: d.socialLinkIds ?? undefined,
    placeId: d.placeId,
    cloverMerchantId: d.cloverMerchantId ?? undefined,
    ogImagePath: d.ogImagePath ?? undefined,
    seoDescription: d.seoDescription ?? undefined,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}
