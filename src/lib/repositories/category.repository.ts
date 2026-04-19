/**
 * Category repository — all Firestore access for product-category documents.
 * Server-side only (uses firebase-admin).
 */
import { FieldValue } from 'firebase-admin/firestore';
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
 */
export async function listActiveCategories(): Promise<
  ProductCategorySummary[]
> {
  const snap = await categoriesCol()
    .where('isActive', '==', true)
    .orderBy('order')
    .get();

  return snap.docs.map(doc => docToCategorySummary(doc.id, doc.data()));
}

/**
 * List all categories regardless of active status — admin use only.
 */
export async function listAllCategories(): Promise<ProductCategoryConfig[]> {
  const snap = await categoriesCol().orderBy('order').get();
  return snap.docs.map(doc => docToCategory(doc.id, doc.data()));
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

  if (existing.exists) {
    await col.doc(data.slug).set(
      {
        slug: data.slug,
        label: data.label,
        description: data.description,
        order: data.order,
        isActive: data.isActive,
        updatedAt: now,
      },
      { merge: true }
    );
  } else {
    await col.doc(data.slug).set({
      slug: data.slug,
      label: data.label,
      description: data.description,
      order: data.order,
      isActive: data.isActive,
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
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } satisfies ProductCategoryConfig;
}
