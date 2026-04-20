/**
 * Promo repository — all Firestore access for promotion documents.
 * Server-side only (uses firebase-admin).
 */
import { cache } from 'react';
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { Promo, PromoSummary } from '@/types';
import type { PageResult } from './types';

// ── Collection helpers ────────────────────────────────────────────────────

function promosCol() {
  return getAdminFirestore().collection('promos');
}

// ── Pagination helpers ────────────────────────────────────────────────────

async function resolveCursor(
  cursor: string | undefined
): Promise<FirebaseFirestore.DocumentSnapshot | undefined> {
  if (!cursor) return undefined;
  const snap = await promosCol().doc(cursor).get();
  return snap.exists ? snap : undefined;
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all promos regardless of active flag — admin use only.
 * Default limit: 50 (admin context).
 */
export async function listAllPromos(
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<PromoSummary>> {
  const limit = opts.limit ?? 50;
  let query = promosCol().orderBy('name').limit(limit);

  const afterSnap = await resolveCursor(opts.cursor);
  if (afterSnap) query = query.startAfter(afterSnap);

  const snap = await query.get();
  const items = snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      slug: d.slug,
      name: d.name,
      tagline: d.tagline,
      image: d.image ?? undefined,
      active: d.active,
      endDate: d.endDate ?? undefined,
      locationSlug: d.locationSlug ?? undefined,
    } satisfies PromoSummary;
  });
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * List all currently active promos.
 * "Active" = active flag is true AND endDate is in the future (Firestore-side filter).
 * Default limit: 25 (storefront context).
 */
export async function listActivePromos(
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<PromoSummary>> {
  const limit = opts.limit ?? 25;
  let query = promosCol()
    .where('active', '==', true)
    .where('endDate', '>', new Date())
    .orderBy('endDate')
    .limit(limit);

  const afterSnap = await resolveCursor(opts.cursor);
  if (afterSnap) query = query.startAfter(afterSnap);

  const snap = await query.get();
  const items = snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      slug: d.slug,
      name: d.name,
      tagline: d.tagline,
      image: d.image ?? undefined,
      active: d.active,
      endDate: d.endDate ?? undefined,
      locationSlug: d.locationSlug ?? undefined,
    } satisfies PromoSummary;
  });
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * Fetch a single promo by slug.
 * Returns null if not found.
 * Wrapped with React cache() to deduplicate parallel calls within the same
 * request (e.g. generateMetadata + page component both reading the same slug).
 */
export const getPromoBySlug = cache(
  async (slug: string): Promise<Promo | null> => {
    const doc = await promosCol().doc(slug).get();
    if (!doc.exists) return null;
    // doc.data() is safe here: existence is confirmed on the line above
    return docToPromo(doc.id, doc.data()!);
  }
);

/**
 * Fetch promos for a specific location slug.
 * Default limit: 25 (storefront context).
 */
export async function getPromosByLocationSlug(
  locationSlug: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<PromoSummary>> {
  const limit = opts.limit ?? 25;
  let query = promosCol()
    .where('active', '==', true)
    .where('locationSlug', '==', locationSlug)
    .limit(limit);

  const afterSnap = await resolveCursor(opts.cursor);
  if (afterSnap) query = query.startAfter(afterSnap);

  const snap = await query.get();
  const items = snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      slug: d.slug,
      name: d.name,
      tagline: d.tagline,
      image: d.image ?? undefined,
      active: d.active,
      endDate: d.endDate ?? undefined,
      locationSlug: d.locationSlug ?? undefined,
    } satisfies PromoSummary;
  });
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

// ── Write operations ──────────────────────────────────────────────────────

export async function deletePromo(slug: string): Promise<void> {
  await promosCol().doc(slug).delete();
}

export async function upsertPromo(
  data: Omit<Promo, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = promosCol();
  const now = new Date();
  const payload = stripUndefinedFields({ ...data, updatedAt: now });
  await col.doc(data.slug).set(payload, { merge: true });
  return data.slug;
}

// ── Private helpers ───────────────────────────────────────────────────────

function docToPromo(id: string, d: FirebaseFirestore.DocumentData): Promo {
  return {
    id,
    slug: d.slug,
    name: d.name,
    tagline: d.tagline ?? '',
    description: d.description ?? '',
    details: d.details ?? '',
    cta: d.cta ?? '',
    ctaPath: d.ctaPath ?? '/',
    image: d.image ?? undefined,
    locationSlug: d.locationSlug ?? undefined,
    keywords: d.keywords ?? undefined,
    active: d.active ?? false,
    startDate: d.startDate ?? undefined,
    endDate: d.endDate ?? undefined,
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
