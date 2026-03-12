/**
 * Promo repository — all Firestore access for promotion documents.
 * Server-side only (uses firebase-admin).
 */
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { Promo, PromoSummary } from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function promosCol() {
  return getAdminFirestore().collection('promos');
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all currently active promos.
 * "Active" = active flag is true AND endDate is either absent or in the future.
 */
export async function listActivePromos(): Promise<PromoSummary[]> {
  const snap = await promosCol()
    .where('active', '==', true)
    .orderBy('name')
    .get();

  const now = new Date();
  return snap.docs
    .map(doc => {
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
    })
    .filter(p => !p.endDate || new Date(p.endDate) > now);
}

/**
 * Fetch a single promo by slug.
 * Returns null if not found.
 */
export async function getPromoBySlug(slug: string): Promise<Promo | null> {
  const doc = await promosCol().doc(slug).get();
  if (!doc.exists) return null;
  // doc.data() is safe here: existence is confirmed on the line above
  return docToPromo(doc.id, doc.data()!);
}

/**
 * Fetch promos for a specific location slug.
 */
export async function getPromosByLocationSlug(
  locationSlug: string
): Promise<PromoSummary[]> {
  const snap = await promosCol()
    .where('active', '==', true)
    .where('locationSlug', '==', locationSlug)
    .get();

  return snap.docs.map(doc => {
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
}

// ── Write operations ──────────────────────────────────────────────────────

export async function upsertPromo(
  data: Omit<Promo, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = promosCol();
  const now = new Date();
  await col.doc(data.slug).set({ ...data, updatedAt: now }, { merge: true });
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
