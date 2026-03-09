/**
 * Product repository — all Firestore access for product documents.
 * Server-side only (uses firebase-admin).
 */
import {
  getAdminFirestore,
  toDate,
  DEFAULT_TENANT_ID,
} from '@/lib/firebase/admin';
import type { Product, ProductSummary, ProductCategory } from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function productsCol(tenantId: string = DEFAULT_TENANT_ID) {
  return getAdminFirestore().collection(`tenants/${tenantId}/products`);
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all active products, ordered by name.
 * Returns lightweight summaries for grid/list views.
 */
export async function listProducts(
  tenantId: string = DEFAULT_TENANT_ID
): Promise<ProductSummary[]> {
  const snap = await productsCol(tenantId)
    .where('status', '==', 'active')
    .orderBy('name')
    .get();

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      slug: d.slug,
      name: d.name,
      category: d.category,
      image: d.image ?? undefined,
      featured: d.featured ?? false,
      status: d.status,
    } satisfies ProductSummary;
  });
}

/**
 * List featured active products (used on homepage).
 */
export async function listFeaturedProducts(
  tenantId: string = DEFAULT_TENANT_ID
): Promise<ProductSummary[]> {
  const snap = await productsCol(tenantId)
    .where('status', '==', 'active')
    .where('featured', '==', true)
    .orderBy('name')
    .get();

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      slug: d.slug,
      name: d.name,
      category: d.category,
      image: d.image ?? undefined,
      featured: true,
      status: d.status,
    } satisfies ProductSummary;
  });
}

/**
 * List active products by category.
 */
export async function listProductsByCategory(
  category: ProductCategory,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<ProductSummary[]> {
  const snap = await productsCol(tenantId)
    .where('status', '==', 'active')
    .where('category', '==', category)
    .orderBy('name')
    .get();

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      slug: d.slug,
      name: d.name,
      category: d.category,
      image: d.image ?? undefined,
      featured: d.featured ?? false,
      status: d.status,
    } satisfies ProductSummary;
  });
}

/**
 * Fetch a single product by slug.
 * Returns null if not found.
 */
export async function getProductBySlug(
  slug: string,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<Product | null> {
  const snap = await productsCol(tenantId)
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return docToProduct(doc.id, doc.data());
}

// ── Write operations ──────────────────────────────────────────────────────

export async function upsertProduct(
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  tenantId: string = DEFAULT_TENANT_ID
): Promise<string> {
  const col = productsCol(tenantId);
  const now = new Date();

  if (data.id) {
    await col.doc(data.id).set({ ...data, updatedAt: now }, { merge: true });
    return data.id;
  }

  const ref = await col.add({ ...data, createdAt: now, updatedAt: now });
  return ref.id;
}

export async function setProductStatus(
  id: string,
  status: Product['status'],
  tenantId: string = DEFAULT_TENANT_ID
): Promise<void> {
  await productsCol(tenantId).doc(id).update({ status, updatedAt: new Date() });
}

// ── Private helpers ───────────────────────────────────────────────────────

function docToProduct(id: string, d: FirebaseFirestore.DocumentData): Product {
  return {
    id,
    tenantId: d.tenantId,
    slug: d.slug,
    name: d.name,
    category: d.category,
    description: d.description ?? '',
    details: d.details ?? '',
    image: d.image ?? undefined,
    featured: d.featured ?? false,
    status: d.status ?? 'active',
    federalDeadlineRisk: d.federalDeadlineRisk ?? false,
    shippableCategories: d.shippableCategories ?? [],
    coaUrl: d.coaUrl ?? undefined,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}
