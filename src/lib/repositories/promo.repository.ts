/**
 * Promo repository — all Firestore access for promotion documents.
 * Server-side only (uses firebase-admin).
 */
import {
  getAdminFirestore,
  toDate,
  DEFAULT_TENANT_ID,
} from '@/lib/firebase/admin';
import type { Promo, PromoSummary } from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function promosCol(tenantId: string = DEFAULT_TENANT_ID) {
  return getAdminFirestore().collection(`tenants/${tenantId}/promos`);
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all currently active promos.
 * "Active" = active flag is true AND endDate is either absent or in the future.
 */
export async function listActivePromos(
  tenantId: string = DEFAULT_TENANT_ID
): Promise<PromoSummary[]> {
  const snap = await promosCol(tenantId)
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
export async function getPromoBySlug(
  slug: string,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<Promo | null> {
  const snap = await promosCol(tenantId)
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return docToPromo(doc.id, doc.data());
}

/**
 * Fetch promos for a specific location slug.
 */
export async function getPromosByLocationSlug(
  locationSlug: string,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<PromoSummary[]> {
  const snap = await promosCol(tenantId)
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
  data: Omit<Promo, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  tenantId: string = DEFAULT_TENANT_ID
): Promise<string> {
  const col = promosCol(tenantId);
  const now = new Date();

  if (data.id) {
    await col.doc(data.id).set({ ...data, updatedAt: now }, { merge: true });
    return data.id;
  }

  const ref = await col.add({ ...data, createdAt: now, updatedAt: now });
  return ref.id;
}

// ── Private helpers ───────────────────────────────────────────────────────

function docToPromo(id: string, d: FirebaseFirestore.DocumentData): Promo {
  return {
    id,
    tenantId: d.tenantId,
    promoId: d.promoId ?? id,
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
