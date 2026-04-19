/**
 * Product repository — all Firestore access for product documents.
 * Server-side only (uses firebase-admin).
 */
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type {
  Product,
  ProductVariant,
  VariantGroup,
  VariantOption,
  ProductSummary,
  LabResults,
  ProductStrain,
  NutritionFacts,
} from '@/types';
import type { PageResult } from './types';

// ── Collection helpers ────────────────────────────────────────────────────

function productsCol() {
  return getAdminFirestore().collection('products');
}

// ── Pagination helpers ────────────────────────────────────────────────────

async function resolveCursor(
  cursor: string | undefined
): Promise<FirebaseFirestore.DocumentSnapshot | undefined> {
  if (!cursor) return undefined;
  const snap = await productsCol().doc(cursor).get();
  return snap.exists ? snap : undefined;
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all products regardless of status — admin use only.
 * Default limit: 50 (admin context).
 */
export async function listAllProducts(
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<ProductSummary>> {
  const limit = opts.limit ?? 50;
  let query = productsCol()
    .orderBy('name')
    .limit(limit) as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;

  const afterSnap = await resolveCursor(opts.cursor);
  if (afterSnap) query = query.startAfter(afterSnap);

  const snap = await query.get();
  const items = snap.docs.map(doc => docToProductSummary(doc.id, doc.data()));
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * List archived products only — admin use only, fetched on demand.
 * Default limit: 50 (admin context).
 */
export async function listArchivedProducts(
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<ProductSummary>> {
  const limit = opts.limit ?? 50;
  let query = productsCol()
    .where('status', '==', 'archived')
    .orderBy('name')
    .limit(limit) as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;

  const afterSnap = await resolveCursor(opts.cursor);
  if (afterSnap) query = query.startAfter(afterSnap);

  const snap = await query.get();
  const items = snap.docs.map(doc => docToProductSummary(doc.id, doc.data()));
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * List all active products, ordered by name.
 * Default limit: 50 (admin context); use 25 for storefront.
 */
export async function listProducts(
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<ProductSummary>> {
  const limit = opts.limit ?? 50;
  let query = productsCol()
    .where('status', '==', 'active')
    .orderBy('name')
    .limit(limit) as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;

  const afterSnap = await resolveCursor(opts.cursor);
  if (afterSnap) query = query.startAfter(afterSnap);

  const snap = await query.get();
  const items = snap.docs.map(doc => docToProductSummary(doc.id, doc.data()));
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * Fetch products by their slugs (document IDs).
 * Used by storefront pages to join inventory results with product catalog data.
 * Returns results ordered by name. Silently skips missing or non-active slugs.
 * No pagination — callers pass an explicit slug list.
 */
export async function listProductsByIds(
  slugs: string[]
): Promise<ProductSummary[]> {
  if (slugs.length === 0) return [];

  const snaps = await Promise.all(
    slugs.map(slug => productsCol().doc(slug).get())
  );

  return snaps
    .filter(doc => doc.exists && doc.data()?.status === 'active')
    .map(doc => docToProductSummary(doc.id, doc.data()!))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List active products by category.
 * Default limit: 25 (storefront context).
 */
export async function listProductsByCategory(
  category: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<ProductSummary>> {
  const limit = opts.limit ?? 25;
  let query = productsCol()
    .where('status', '==', 'active')
    .where('category', '==', category)
    .orderBy('name')
    .limit(limit) as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;

  const afterSnap = await resolveCursor(opts.cursor);
  if (afterSnap) query = query.startAfter(afterSnap);

  const snap = await query.get();
  const items = snap.docs.map(doc => docToProductSummary(doc.id, doc.data()));
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * Fetch a single product by slug.
 * Returns null if not found.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const doc = await productsCol().doc(slug).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  return docToProduct(doc.id, data);
}

/**
 * List active products for a given vendor slug.
 * Default limit: 25 (storefront context).
 */
export async function listProductsByVendor(
  vendorSlug: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<ProductSummary>> {
  const limit = opts.limit ?? 25;
  let query = productsCol()
    .where('status', '==', 'active')
    .where('vendorSlug', '==', vendorSlug)
    .orderBy('name')
    .limit(limit) as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;

  const afterSnap = await resolveCursor(opts.cursor);
  if (afterSnap) query = query.startAfter(afterSnap);

  const snap = await query.get();
  const items = snap.docs.map(doc => docToProductSummary(doc.id, doc.data()));
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * Fetch related products from the same category, excluding the given slug.
 * Used on the product detail page to replace the full-catalog listProducts() call.
 */
export async function getRelatedProducts(
  excludeSlug: string,
  category: string,
  limit = 6
): Promise<ProductSummary[]> {
  // Fetch one extra so we can exclude the current product and still return `limit` items
  const snap = await productsCol()
    .where('status', '==', 'active')
    .where('category', '==', category)
    .limit(limit + 1)
    .get();

  return snap.docs
    .filter(doc => doc.id !== excludeSlug)
    .slice(0, limit)
    .map(doc => docToProductSummary(doc.id, doc.data()));
}

// ── Write operations ──────────────────────────────────────────────────────

export async function upsertProduct(
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = productsCol();
  const now = new Date();
  const payload = stripUndefinedFields({ ...data, updatedAt: now });
  await col.doc(data.slug).set(payload, { merge: true });
  return data.slug;
}

/**
 * Explicitly delete top-level fields from a product document.
 * Used when a field must be removed entirely (e.g. featured image cleared).
 * `set({ merge: true })` with undefined values does NOT remove fields —
 * this function uses FieldValue.delete() to handle that case.
 */
export async function clearProductFields(
  slug: string,
  fields: ('image' | 'images')[]
): Promise<void> {
  if (fields.length === 0) return;
  const { FieldValue } = await import('firebase-admin/firestore');
  const update = Object.fromEntries(fields.map(f => [f, FieldValue.delete()]));
  await productsCol().doc(slug).update(update);
}

export async function setProductStatus(
  slug: string,
  status: Product['status']
): Promise<void> {
  const docRef = productsCol().doc(slug);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new Error(`Product '${slug}' not found`);
  }

  await docRef.update({ status, updatedAt: new Date() });
}

// ── Private helpers ───────────────────────────────────────────────────────

/** Valid strain values for defensive mapping */
const VALID_STRAINS = new Set<ProductStrain>([
  'indica',
  'sativa',
  'hybrid',
  'cbd',
]);

function docToProductSummary(
  id: string,
  d: FirebaseFirestore.DocumentData
): ProductSummary {
  return {
    id,
    slug: d.slug,
    name: d.name,
    category: d.category ?? '',
    image: d.image ?? undefined,
    images: Array.isArray(d.images) ? (d.images as string[]) : undefined,
    status: d.status,
    availableAt: d.availableAt ?? [],
    vendorSlug: d.vendorSlug ?? undefined,
    strain:
      typeof d.strain === 'string' &&
      VALID_STRAINS.has(d.strain as ProductStrain)
        ? (d.strain as ProductStrain)
        : undefined,
    variants: docToVariants(d.variants),
    variantGroups: docToVariantGroups(d.variantGroups),
    leaflyUrl: d.leaflyUrl ?? undefined,
  } satisfies ProductSummary;
}

function docToProduct(id: string, d: FirebaseFirestore.DocumentData): Product {
  return {
    id,
    slug: d.slug,
    name: d.name,
    category: d.category ?? '',
    details: d.details ?? '',
    image: d.image ?? undefined,
    images: Array.isArray(d.images) ? (d.images as string[]) : undefined,
    status: d.status ?? 'active',
    coaUrl: d.coaUrl ?? undefined,
    availableAt: d.availableAt ?? [],
    vendorSlug: d.vendorSlug ?? undefined,
    labResults: docToLabResults(d.labResults),
    leaflyUrl: d.leaflyUrl ?? undefined,
    nutritionFacts: docToNutritionFacts(d),
    strain:
      typeof d.strain === 'string' &&
      VALID_STRAINS.has(d.strain as ProductStrain)
        ? (d.strain as ProductStrain)
        : undefined,
    effects: Array.isArray(d.effects) ? (d.effects as string[]) : undefined,
    flavors: Array.isArray(d.flavors) ? (d.flavors as string[]) : undefined,
    variantGroups: docToVariantGroups(d.variantGroups),
    variants: docToVariants(d.variants),
    extractionType:
      typeof d.extractionType === 'string' ? d.extractionType : undefined,
    hardwareType:
      typeof d.hardwareType === 'string' ? d.hardwareType : undefined,
    volumeMl: typeof d.volumeMl === 'number' ? d.volumeMl : undefined,
    thcMgPerServing:
      typeof d.thcMgPerServing === 'number' ? d.thcMgPerServing : undefined,
    cbdMgPerServing:
      typeof d.cbdMgPerServing === 'number' ? d.cbdMgPerServing : undefined,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } satisfies Product;
}

function docToLabResults(
  raw: FirebaseFirestore.DocumentData | undefined
): LabResults | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  return {
    thcPercent: typeof r.thcPercent === 'number' ? r.thcPercent : undefined,
    cbdPercent: typeof r.cbdPercent === 'number' ? r.cbdPercent : undefined,
    terpenes: Array.isArray(r.terpenes) ? (r.terpenes as string[]) : undefined,
    testDate: typeof r.testDate === 'string' ? r.testDate : undefined,
    labName: typeof r.labName === 'string' ? r.labName : undefined,
  };
}

/**
 * Defensively maps the variantGroups array from Firestore.
 * Groups or options missing required fields are silently skipped.
 */
function docToVariantGroups(raw: unknown): VariantGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid: VariantGroup[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const g = item as Record<string, unknown>;
    if (typeof g.groupId !== 'string' || typeof g.label !== 'string') continue;
    const options: VariantOption[] = [];
    if (Array.isArray(g.options)) {
      for (const o of g.options) {
        if (!o || typeof o !== 'object') continue;
        const opt = o as Record<string, unknown>;
        if (typeof opt.optionId === 'string' && typeof opt.label === 'string') {
          options.push({ optionId: opt.optionId, label: opt.label });
        }
      }
    }
    valid.push({
      groupId: g.groupId,
      label: g.label,
      combinable: g.combinable === true,
      options,
    });
  }
  return valid.length > 0 ? valid : undefined;
}

/**
 * Defensively maps the variants array from Firestore.
 * Entries missing required fields (variantId, label) are silently skipped.
 */
function docToVariants(raw: unknown): ProductVariant[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid: ProductVariant[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const v = item as Record<string, unknown>;
    if (typeof v.variantId !== 'string' || typeof v.label !== 'string')
      continue;
    const variant: ProductVariant = {
      variantId: v.variantId,
      label: v.label,
    };
    if (v.weight && typeof v.weight === 'object') {
      const w = v.weight as Record<string, unknown>;
      if (typeof w.value === 'number' && (w.unit === 'g' || w.unit === 'oz')) {
        variant.weight = { value: w.value, unit: w.unit };
      }
    }
    if (typeof v.quantity === 'number') {
      variant.quantity = v.quantity;
    }
    if (v.dose && typeof v.dose === 'object') {
      const dose = v.dose as Record<string, unknown>;
      if (
        typeof dose.value === 'number' &&
        (dose.unit === 'mg' || dose.unit === 'mcg')
      ) {
        variant.dose = { value: dose.value, unit: dose.unit };
      }
    }
    valid.push(variant);
  }
  return valid.length > 0 ? valid : undefined;
}

function docToNutritionFacts(
  d: FirebaseFirestore.DocumentData
): NutritionFacts | undefined {
  const nf = d.nutritionFacts;
  if (!nf || typeof nf !== 'object') return undefined;
  if (typeof nf.servingSize !== 'string') return undefined;
  if (typeof nf.servingsPerContainer !== 'number') return undefined;
  if (typeof nf.calories !== 'number') return undefined;
  return {
    servingSize: nf.servingSize,
    servingsPerContainer: nf.servingsPerContainer,
    calories: nf.calories,
    totalFat: typeof nf.totalFat === 'string' ? nf.totalFat : undefined,
    sodium: typeof nf.sodium === 'string' ? nf.sodium : undefined,
    totalCarbs: typeof nf.totalCarbs === 'string' ? nf.totalCarbs : undefined,
    sugars: typeof nf.sugars === 'string' ? nf.sugars : undefined,
    protein: typeof nf.protein === 'string' ? nf.protein : undefined,
  };
}

function stripUndefinedFields<T extends Record<string, unknown>>(
  value: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
