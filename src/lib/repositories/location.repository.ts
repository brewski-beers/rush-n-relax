/**
 * Location repository — all Firestore access for location documents.
 * Server-side only (uses firebase-admin). UI code calls these from Server Components.
 */
import { cache } from 'react';
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { Location, LocationSummary } from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function locationsCol() {
  return getAdminFirestore().collection('locations');
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all locations, ordered by name.
 * Returns lightweight summaries — use getLocationBySlug for full detail.
 */
export async function listLocations(): Promise<LocationSummary[]> {
  const snap = await locationsCol().orderBy('name').get();
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
 * Wrapped with React cache() to deduplicate parallel calls within the same
 * request (e.g. generateMetadata + page component both reading the same slug).
 */
export const getLocationBySlug = cache(
  async (slug: string): Promise<Location | null> => {
    const doc = await locationsCol().doc(slug).get();
    if (!doc.exists) return null;
    // doc.data() is safe here: existence is confirmed on the line above
    return docToLocation(doc.id, doc.data()!);
  }
);

/**
 * Fetch a single location by Firestore document ID.
 */
export async function getLocationById(id: string): Promise<Location | null> {
  const doc = await locationsCol().doc(id).get();
  if (!doc.exists) return null;
  // doc.data() is safe here: existence is confirmed on the line above
  return docToLocation(doc.id, doc.data()!);
}

// ── Write operations ──────────────────────────────────────────────────────

/**
 * Upsert a location document (admin use only).
 * Uses slug as the document ID. Creates if absent, merges if present.
 */
export async function upsertLocation(
  data: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = locationsCol();
  const now = new Date();
  const payload = stripUndefinedFields({ ...data, updatedAt: now });
  await col.doc(data.slug).set(payload, { merge: true });
  return data.slug;
}

// ── Private helpers ───────────────────────────────────────────────────────

function docToLocation(
  id: string,
  d: FirebaseFirestore.DocumentData
): Location {
  return {
    id,
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

function stripUndefinedFields<T extends Record<string, unknown>>(
  value: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
