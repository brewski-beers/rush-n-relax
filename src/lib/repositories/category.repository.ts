/**
 * Category repository — all Firestore access for product-category documents.
 * Server-side only (uses firebase-admin).
 */
import { FieldValue } from 'firebase-admin/firestore';
import type { PageResult } from './types';
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { ProductCategoryConfig, ProductCategorySummary } from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function categoriesCol() {
  return getAdminFirestore().collection('product-categories');
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all active categories, ordered by `order` ASC.
 * Returns lightweight summaries for the storefront filter bar and product forms.
 * Default limit: 50 — categories are a small set, no pagination needed in practice.
 */
export async function listActiveCategories(
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<ProductCategorySummary>> {
  const limit = opts.limit ?? 50;
  let query = categoriesCol()
    .where('isActive', '==', true)
    .orderBy('order')
    .limit(limit);

  if (opts.cursor) {
    const afterSnap = await categoriesCol().doc(opts.cursor).get();
    if (afterSnap.exists) query = query.startAfter(afterSnap);
  }

  const snap = await query.get();
  const items = snap.docs.map(doc => docToCategorySummary(doc.id, doc.data()));
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * List all categories regardless of active status — admin use only.
 * Default limit: 50 — categories are a small set, no pagination needed in practice.
 */
export async function listAllCategories(
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<ProductCategoryConfig>> {
  const limit = opts.limit ?? 50;
  let query = categoriesCol()
    .orderBy('order')
    .limit(limit);

  if (opts.cursor) {
    const afterSnap = await categoriesCol().doc(opts.cursor).get();
    if (afterSnap.exists) query = query.startAfter(afterSnap);
  }

  const snap = await query.get();
  const items = snap.docs.map(doc => docToCategory(doc.id, doc.data()));
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * Fetch a single category by slug.
 * Returns null if not found.
 */
export async function getCategoryBySlug(
  slug: string
): Promise<ProductCategoryConfig | null> {
  const doc = await categoriesCol().doc(slug).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  return docToCategory(doc.id, data);
}

// ── Write operations ──────────────────────────────────────────────────────

/**
 * Create or update a category document.
 * Uses `set({ merge: true })` with `serverTimestamp()` so that:
 * - On create: both `createdAt` and `updatedAt` are set
 * - On update: only `updatedAt` is refreshed (createdAt preserved via merge)
 */
export async function upsertCategory(
  data: Omit<ProductCategoryConfig, 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = categoriesCol();
  const existing = await col.doc(data.slug).get();
  const now = FieldValue.serverTimestamp();

  const fields = {
    slug: data.slug,
    label: data.label,
    description: data.description,
    order: data.order,
    isActive: data.isActive,
    requiresCannabisProfile: data.requiresCannabisProfile,
    requiresNutritionFacts: data.requiresNutritionFacts,
    requiresCOA: data.requiresCOA,
  };

  if (existing.exists) {
    await col.doc(data.slug).set(
      { ...fields, updatedAt: now },
      { merge: true }
    );
  } else {
    await col.doc(data.slug).set({
      ...fields,
      createdAt: now,
      updatedAt: now,
    });
  }

  return data.slug;
}

/**
 * Batch-update the `order` field for a list of category slugs.
 * The position in the array (0-indexed) maps to an order value of index + 1.
 */
export async function reorderCategories(orderedSlugs: string[]): Promise<void> {
  const db = getAdminFirestore();
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  orderedSlugs.forEach((slug, index) => {
    batch.update(categoriesCol().doc(slug), {
      order: index + 1,
      updatedAt: now,
    });
  });
  await batch.commit();
}

/**
 * Atomically toggle isActive on a category document.
 */
export async function setCategoryStatus(
  slug: string,
  isActive: boolean
): Promise<void> {
  await categoriesCol()
    .doc(slug)
    .update({ isActive, updatedAt: FieldValue.serverTimestamp() });
}

// ── Private helpers ───────────────────────────────────────────────────────

function docToCategorySummary(
  id: string,
  d: FirebaseFirestore.DocumentData
): ProductCategorySummary {
  return {
    slug: id,
    label: d.label,
    order: d.order,
    requiresCannabisProfile: d.requiresCannabisProfile ?? false,
    requiresNutritionFacts: d.requiresNutritionFacts ?? false,
    requiresCOA: d.requiresCOA ?? false,
  } satisfies ProductCategorySummary;
}

function docToCategory(
  id: string,
  d: FirebaseFirestore.DocumentData
): ProductCategoryConfig {
  return {
    slug: id,
    label: d.label,
    description: d.description ?? '',
    order: d.order,
    isActive: d.isActive ?? false,
    requiresCannabisProfile: d.requiresCannabisProfile ?? false,
    requiresNutritionFacts: d.requiresNutritionFacts ?? false,
    requiresCOA: d.requiresCOA ?? false,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } satisfies ProductCategoryConfig;
}
