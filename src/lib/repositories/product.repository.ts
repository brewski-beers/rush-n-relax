/**
 * Product repository — all Firestore access for product documents.
 * Server-side only (uses firebase-admin).
 */
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { Product, ProductSummary, ProductCategory } from '@/types';

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
  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      slug: d.slug,
      name: d.name,
      category: d.category,
      description: d.description ?? '',
      image: d.image ?? undefined,
      featured: d.featured ?? false,
      status: d.status,
      availableAt: d.availableAt ?? [],
    } satisfies ProductSummary;
  });
}

/**
 * List all active products, ordered by name.
 * Returns lightweight summaries for grid/list views.
 */
export async function listProducts(): Promise<ProductSummary[]> {
  const snap = await productsCol()
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
      description: d.description ?? '',
      image: d.image ?? undefined,
      featured: d.featured ?? false,
      status: d.status,
      availableAt: d.availableAt ?? [],
    } satisfies ProductSummary;
  });
}

/**
 * List featured active products (used on homepage).
 */
export async function listFeaturedProducts(): Promise<ProductSummary[]> {
  const snap = await productsCol()
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
      description: d.description ?? '',
      image: d.image ?? undefined,
      featured: true,
      status: d.status,
      availableAt: d.availableAt ?? [],
    } satisfies ProductSummary;
  });
}

/**
 * List active products by category.
 */
export async function listProductsByCategory(
  category: ProductCategory
): Promise<ProductSummary[]> {
  const snap = await productsCol()
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
      description: d.description ?? '',
      image: d.image ?? undefined,
      featured: d.featured ?? false,
      status: d.status,
      availableAt: d.availableAt ?? [],
    } satisfies ProductSummary;
  });
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

function docToProduct(id: string, d: FirebaseFirestore.DocumentData): Product {
  return {
    id,
    slug: d.slug,
    name: d.name,
    category: d.category,
    description: d.description ?? '',
    details: d.details ?? '',
    image: d.image ?? undefined,
    featured: d.featured ?? false,
    status: d.status ?? 'active',
    federalDeadlineRisk: d.federalDeadlineRisk ?? false,
    coaUrl: d.coaUrl ?? undefined,
    availableAt: d.availableAt ?? [],
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
