/**
 * Product repository — all Firestore access for product documents.
 * Server-side only (uses firebase-admin).
 */
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type {
  Product,
  ProductVariant,
  ProductSummary,
  LabResults,
  ProductStrain,
} from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function productsCol() {
  return getAdminFirestore().collection('products');
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all products regardless of status — admin use only.
 */
export async function listAllProducts(): Promise<ProductSummary[]> {
  const snap = await productsCol().orderBy('name').get();
  return snap.docs.map(doc => docToProductSummary(doc.id, doc.data()));
}

/**
 * List all active products, ordered by name.
 * Returns lightweight summaries for admin inventory tables.
 */
export async function listProducts(): Promise<ProductSummary[]> {
  const snap = await productsCol()
    .where('status', '==', 'active')
    .orderBy('name')
    .get();

  return snap.docs.map(doc => docToProductSummary(doc.id, doc.data()));
}

/**
 * Fetch products by their slugs (document IDs).
 * Used by storefront pages to join inventory results with product catalog data.
 * Returns results ordered by name. Silently skips missing or non-active slugs.
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
 */
export async function listProductsByCategory(
  category: string
): Promise<ProductSummary[]> {
  const snap = await productsCol()
    .where('status', '==', 'active')
    .where('category', '==', category)
    .orderBy('name')
    .get();

  return snap.docs.map(doc => docToProductSummary(doc.id, doc.data()));
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
    federalDeadlineRisk: d.federalDeadlineRisk ?? false,
    coaUrl: d.coaUrl ?? undefined,
    availableAt: d.availableAt ?? [],
    vendorSlug: d.vendorSlug ?? undefined,
    labResults: docToLabResults(d.labResults),
    leaflyUrl: d.leaflyUrl ?? undefined,
    strain:
      typeof d.strain === 'string' &&
      VALID_STRAINS.has(d.strain as ProductStrain)
        ? (d.strain as ProductStrain)
        : undefined,
    effects: Array.isArray(d.effects) ? (d.effects as string[]) : undefined,
    flavors: Array.isArray(d.flavors) ? (d.flavors as string[]) : undefined,
    variants: docToVariants(d.variants),
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

function stripUndefinedFields<T extends Record<string, unknown>>(
  value: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
