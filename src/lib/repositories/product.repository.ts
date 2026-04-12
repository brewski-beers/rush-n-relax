/**
 * Product repository — all Firestore access for product documents.
 * Server-side only (uses firebase-admin).
 */
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { Product, ProductSummary, LabResults } from '@/types';

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

function docToProductSummary(
  id: string,
  d: FirebaseFirestore.DocumentData
): ProductSummary {
  return {
    id,
    slug: d.slug,
    name: d.name,
    category: d.category ?? '',
    description: d.description ?? '',
    image: d.image ?? undefined,
    images: Array.isArray(d.images) ? (d.images as string[]) : undefined,
    status: d.status,
    availableAt: d.availableAt ?? [],
    vendorSlug: d.vendorSlug ?? undefined,
  } satisfies ProductSummary;
}

function docToProduct(id: string, d: FirebaseFirestore.DocumentData): Product {
  return {
    id,
    slug: d.slug,
    name: d.name,
    category: d.category ?? '',
    description: d.description ?? '',
    details: d.details ?? '',
    image: d.image ?? undefined,
    images: Array.isArray(d.images) ? (d.images as string[]) : undefined,
    status: d.status ?? 'active',
    federalDeadlineRisk: d.federalDeadlineRisk ?? false,
    coaUrl: d.coaUrl ?? undefined,
    availableAt: d.availableAt ?? [],
    vendorSlug: d.vendorSlug ?? undefined,
    labResults: docToLabResults(d.labResults),
    descriptionSource: d.descriptionSource ?? undefined,
    leaflyUrl: d.leaflyUrl ?? undefined,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
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

function stripUndefinedFields<T extends Record<string, unknown>>(
  value: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
