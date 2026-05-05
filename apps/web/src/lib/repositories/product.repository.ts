/**
 * Product repository — all Firestore access for product documents.
 * Server-side only (uses firebase-admin).
 */
import { cache } from 'react';
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type {
  Product,
  ProductVariant,
  ProductVariantSpec,
  ProductVariantLocation,
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
  let query = productsCol().orderBy('name').limit(limit);

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
    .limit(limit);

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
    .limit(limit);

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
    .limit(limit);

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
 * Wrapped with React cache() to deduplicate parallel calls within the same
 * request (e.g. generateMetadata + page component both reading the same slug).
 */
export const getProductBySlug = cache(
  async (slug: string): Promise<Product | null> => {
    const doc = await productsCol().doc(slug).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (!data) return null;
    return docToProduct(doc.id, data);
  }
);

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
    .limit(limit);

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
  const sameCategorySnap = await productsCol()
    .where('status', '==', 'active')
    .where('category', '==', category)
    .limit(limit + 1)
    .get();

  const sameCategory = sameCategorySnap.docs
    .filter(doc => doc.id !== excludeSlug)
    .slice(0, limit)
    .map(doc => docToProductSummary(doc.id, doc.data()));

  if (sameCategory.length >= limit) return sameCategory;

  // Fall back to other active products so thin categories still surface suggestions.
  const needed = limit - sameCategory.length;
  const seenSlugs = new Set([excludeSlug, ...sameCategory.map(p => p.slug)]);
  const fillerSnap = await productsCol()
    .where('status', '==', 'active')
    .limit(limit + seenSlugs.size)
    .get();
  const fillers = fillerSnap.docs
    .filter(doc => !seenSlugs.has(doc.id))
    .slice(0, needed)
    .map(doc => docToProductSummary(doc.id, doc.data()));

  return [...sameCategory, ...fillers];
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
    variantSpecs: readVariantSpecs(d),
    inStockAt: Array.isArray(d.inStockAt)
      ? (d.inStockAt as string[])
      : undefined,
    featuredAt: Array.isArray(d.featuredAt)
      ? (d.featuredAt as string[])
      : undefined,
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
    variantSpecs: readVariantSpecs(d),
    inStockAt: Array.isArray(d.inStockAt)
      ? (d.inStockAt as string[])
      : undefined,
    pickupAt: Array.isArray(d.pickupAt) ? (d.pickupAt as string[]) : undefined,
    featuredAt: Array.isArray(d.featuredAt)
      ? (d.featuredAt as string[])
      : undefined,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } satisfies Product;
}

function docToLabResults(
  raw: FirebaseFirestore.DocumentData | undefined
): LabResults | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  // Narrow DocumentData's `any`-valued map to `unknown` so field reads are type-checked.

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

// ── Variant/location helpers (#306) ───────────────────────────────────────

/**
 * Thrown when a transactional decrement detects fewer units available than
 * requested. The whole transaction is rolled back when this error is thrown,
 * so no partial writes survive.
 *
 * Owned by the product repository as of #306 (variant model). Re-exported
 * from the inventory repository for back-compat with existing call sites
 * (order start, agechecker webhook) until #312 cleanup.
 */
export class InsufficientStockError extends Error {
  readonly productId: string;
  readonly variantId: string;
  readonly locationId: string;
  readonly available: number;
  readonly requested: number;

  constructor(
    locationId: string,
    productId: string,
    available: number,
    requested: number,
    variantId: string = 'default'
  ) {
    super(
      `Insufficient stock for '${productId}' (variant '${variantId}') at '${locationId}': have ${available}, need ${requested}`
    );
    this.name = 'InsufficientStockError';
    this.productId = productId;
    this.variantId = variantId;
    this.locationId = locationId;
    this.available = available;
    this.requested = requested;
  }
}

/**
 * Recompute the denormalized `inStockAt` / `pickupAt` / `featuredAt`
 * arrays from the `variantSpecs` map. Pure function — no I/O.
 *
 * - `inStockAt`: any variant has `qty > 0` at this location
 * - `pickupAt`: any variant has `qty > 0` AND `availablePickup === true`
 * - `featuredAt`: any variant has `qty > 0` AND `featured === true`
 */
function recomputeIndexes(
  variantSpecs: { [variantId: string]: ProductVariantSpec } | undefined
): { inStockAt: string[]; pickupAt: string[]; featuredAt: string[] } {
  const inStockAt = new Set<string>();
  const pickupAt = new Set<string>();
  const featuredAt = new Set<string>();

  if (!variantSpecs) {
    return { inStockAt: [], pickupAt: [], featuredAt: [] };
  }

  for (const variant of Object.values(variantSpecs)) {
    if (!variant?.locations) continue;
    for (const [locationId, loc] of Object.entries(variant.locations)) {
      if (!loc || typeof loc.qty !== 'number') continue;
      // #361 — denormalized indexes track AVAILABLE stock (qty minus held
      // reservations), so the storefront stops surfacing a SKU as in-stock
      // the moment its remaining units are entirely reserved.
      const available = loc.qty - (loc.reserved ?? 0);
      if (available <= 0) continue;
      inStockAt.add(locationId);
      if (loc.availablePickup === true) pickupAt.add(locationId);
      if (loc.featured === true) featuredAt.add(locationId);
    }
  }

  return {
    inStockAt: [...inStockAt].sort(),
    pickupAt: [...pickupAt].sort(),
    featuredAt: [...featuredAt].sort(),
  };
}

/**
 * Audit log entry written to `products/{slug}/adjustments/{autoId}` whenever
 * a variant/location entry changes via the helpers in this file. Captures
 * before/after so an operator can reconstruct a manual edit or reconcile
 * an oversell. Source identifies the call site for traceability.
 */
export type VariantAdjustmentSource = 'admin' | 'order' | 'reconcile' | 'seed';

interface VariantAdjustmentLog {
  slug: string;
  variantId: string;
  locationId: string;
  before: ProductVariantLocation | null;
  after: ProductVariantLocation | null;
  delta: number; // after.qty - before.qty (0 when entry was non-stock metadata only)
  source: VariantAdjustmentSource;
  actor?: string;
  reason?: string;
  createdAt: Date;
}

function readVariantSpecs(
  d: FirebaseFirestore.DocumentData
): { [variantId: string]: ProductVariantSpec } | undefined {
  const raw = d.variantSpecs;
  if (!raw || typeof raw !== 'object') return undefined;
  const out: { [variantId: string]: ProductVariantSpec } = {};
  for (const [variantId, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const variant = v as Record<string, unknown>;
    if (typeof variant.label !== 'string') continue;
    const locations: { [locationId: string]: ProductVariantLocation } = {};
    if (variant.locations && typeof variant.locations === 'object') {
      for (const [locId, locRaw] of Object.entries(
        variant.locations as Record<string, unknown>
      )) {
        if (!locRaw || typeof locRaw !== 'object') continue;
        const loc = locRaw as Record<string, unknown>;
        if (typeof loc.qty !== 'number' || typeof loc.price !== 'number') {
          continue;
        }
        locations[locId] = {
          qty: loc.qty,
          ...(typeof loc.reserved === 'number' ? { reserved: loc.reserved } : {}),
          price: loc.price,
          compareAtPrice:
            typeof loc.compareAtPrice === 'number'
              ? loc.compareAtPrice
              : undefined,
          availablePickup:
            typeof loc.availablePickup === 'boolean'
              ? loc.availablePickup
              : undefined,
          featured:
            typeof loc.featured === 'boolean' ? loc.featured : undefined,
        } satisfies ProductVariantLocation;
      }
    }
    out[variantId] = {
      label: variant.label,
      locations,
    } satisfies ProductVariantSpec;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Set or replace a single variant/location entry on a product. Recomputes
 * the denormalized index arrays and writes an audit log document under
 * `products/{slug}/adjustments`.
 *
 * Runs in a single Firestore transaction so the entry write, index
 * recomputation, and audit log are atomic.
 *
 * Throws when the product does not exist or when `variantSpecs[variantId]`
 * is missing — this helper does not bootstrap variants (the catalog editor
 * is responsible for creating them).
 */
export async function setVariantLocation(
  slug: string,
  variantId: string,
  locationId: string,
  patch: ProductVariantLocation,
  meta: {
    source?: VariantAdjustmentSource;
    actor?: string;
    reason?: string;
  } = {}
): Promise<Product> {
  const db = getAdminFirestore();
  const ref = productsCol().doc(slug);

  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error(`Product '${slug}' not found`);
    }
    const data = snap.data() ?? {};
    const variantSpecs = readVariantSpecs(data) ?? {};
    const existingVariant = variantSpecs[variantId];
    if (!existingVariant) {
      throw new Error(`Variant '${variantId}' not found on product '${slug}'`);
    }

    const before = existingVariant.locations[locationId] ?? null;
    const nextLocations = { ...existingVariant.locations, [locationId]: patch };
    const nextVariantSpecs: { [variantId: string]: ProductVariantSpec } = {
      ...variantSpecs,
      [variantId]: { ...existingVariant, locations: nextLocations },
    };
    const indexes = recomputeIndexes(nextVariantSpecs);

    const now = new Date();
    tx.set(
      ref,
      {
        variantSpecs: nextVariantSpecs,
        inStockAt: indexes.inStockAt,
        pickupAt: indexes.pickupAt,
        featuredAt: indexes.featuredAt,
        updatedAt: now,
      },
      { merge: true }
    );

    const logRef = ref.collection('adjustments').doc();
    tx.create(logRef, {
      slug,
      variantId,
      locationId,
      before,
      after: patch,
      delta: patch.qty - (before?.qty ?? 0),
      source: meta.source ?? 'admin',
      actor: meta.actor,
      reason: meta.reason,
      createdAt: now,
    } satisfies VariantAdjustmentLog);

    return docToProduct(snap.id, {
      ...data,
      variantSpecs: nextVariantSpecs,
      inStockAt: indexes.inStockAt,
      pickupAt: indexes.pickupAt,
      featuredAt: indexes.featuredAt,
      updatedAt: now,
    });
  });
}

/**
 * Atomically decrement stock for a list of variant/location items across
 * (potentially) multiple products in a single Firestore transaction.
 *
 * 1. Read every referenced product doc
 * 2. Validate `variantSpecs[variantId].locations[locationId].qty >= qty`
 *    for each item, accumulating per-product decrements so multiple lines
 *    against the same product/variant compose correctly
 * 3. Apply decrements via a recomputed map (FieldValue.increment is unsafe
 *    here because we also need to recompute `inStockAt`/`pickupAt`/`featuredAt`
 *    based on the post-decrement state)
 * 4. Recompute denormalized indexes for each touched product
 * 5. Throw `InsufficientStockError` on any shortage — the whole transaction
 *    rolls back, so no writes survive
 * 6. Write one audit log entry per item under
 *    `products/{slug}/adjustments`
 */
export async function decrementVariantStock(
  items: {
    slug: string;
    variantId: string;
    locationId: string;
    qty: number;
  }[],
  meta: {
    source?: VariantAdjustmentSource;
    actor?: string;
    reason?: string;
  } = {}
): Promise<void> {
  if (items.length === 0) return;

  const db = getAdminFirestore();

  // Group by slug so each product is read at most once per transaction.
  const slugs = [...new Set(items.map(i => i.slug))];

  await db.runTransaction(async tx => {
    const refs = slugs.map(s => productsCol().doc(s));
    const snaps = await Promise.all(refs.map(r => tx.get(r)));

    // Build per-slug working state
    const working = new Map<
      string,
      {
        ref: FirebaseFirestore.DocumentReference;
        data: FirebaseFirestore.DocumentData;
        variantSpecs: { [variantId: string]: ProductVariantSpec };
        // before snapshot per (variantId, locationId)
        beforeMap: Map<string, ProductVariantLocation | null>;
      }
    >();

    for (let i = 0; i < slugs.length; i++) {
      const snap = snaps[i];
      if (!snap.exists) {
        throw new Error(`Product '${slugs[i]}' not found`);
      }
      const data = snap.data() ?? {};
      const variantSpecs = readVariantSpecs(data) ?? {};
      working.set(slugs[i], {
        ref: refs[i],
        data,
        variantSpecs,
        beforeMap: new Map(),
      });
    }

    // Apply decrements — this loop both validates and mutates the in-memory
    // variantSpecs maps. Multiple lines against the same product/variant
    // compose because each iteration reads the running state.
    for (const item of items) {
      const w = working.get(item.slug);
      if (!w) {
        // unreachable: slugs derives from items
        throw new Error(`Product '${item.slug}' not loaded`);
      }
      const variant = w.variantSpecs[item.variantId];
      if (!variant) {
        throw new Error(
          `Variant '${item.variantId}' not found on product '${item.slug}'`
        );
      }
      const loc = variant.locations[item.locationId];
      const available = loc?.qty ?? 0;
      if (!loc || available < item.qty) {
        throw new InsufficientStockError(
          item.locationId,
          item.slug,
          available,
          item.qty,
          item.variantId
        );
      }
      // Capture original before-state once (first touch wins).
      const beforeKey = `${item.variantId}::${item.locationId}`;
      if (!w.beforeMap.has(beforeKey)) {
        w.beforeMap.set(beforeKey, { ...loc });
      }

      const nextQty = available - item.qty;
      const nextLoc: ProductVariantLocation = {
        ...loc,
        qty: nextQty,
        // Mirror the inventory invariant: when a SKU sells out, drop pickup
        // and featured flags so the storefront stops surfacing it.
        ...(nextQty === 0 ? { availablePickup: false, featured: false } : {}),
      };
      w.variantSpecs[item.variantId] = {
        ...variant,
        locations: { ...variant.locations, [item.locationId]: nextLoc },
      };
    }

    const now = new Date();

    // Write each touched product + its audit logs
    for (const [slug, w] of working) {
      const indexes = recomputeIndexes(w.variantSpecs);
      tx.set(
        w.ref,
        {
          variantSpecs: w.variantSpecs,
          inStockAt: indexes.inStockAt,
          pickupAt: indexes.pickupAt,
          featuredAt: indexes.featuredAt,
          updatedAt: now,
        },
        { merge: true }
      );

      // One audit row per (variantId, locationId) touched on this product.
      for (const [beforeKey, before] of w.beforeMap) {
        const [variantId, locationId] = beforeKey.split('::');
        const after = w.variantSpecs[variantId]?.locations[locationId] ?? null;
        const logRef = w.ref.collection('adjustments').doc();
        tx.create(logRef, {
          slug,
          variantId,
          locationId,
          before,
          after,
          delta: (after?.qty ?? 0) - (before?.qty ?? 0),
          source: meta.source ?? 'order',
          actor: meta.actor,
          reason: meta.reason,
          createdAt: now,
        } satisfies VariantAdjustmentLog);
      }
    }
  });
}

/**
 * List active products that have at least one variant in stock at the given
 * location, using the denormalized `inStockAt` array. Default limit: 25
 * (storefront context).
 */
export async function listProductsInStockAt(
  locationId: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<Product>> {
  const limit = opts.limit ?? 25;
  let query = productsCol()
    .where('status', '==', 'active')
    .where('inStockAt', 'array-contains', locationId)
    .orderBy('name')
    .limit(limit);

  const afterSnap = await resolveCursor(opts.cursor);
  if (afterSnap) query = query.startAfter(afterSnap);

  const snap = await query.get();
  const items = snap.docs.map(doc => docToProduct(doc.id, doc.data()));
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

// ── Reservation helpers (#361) ────────────────────────────────────────────

/**
 * A single hold/release/commit request targeting a (product, variant,
 * location) tuple. Mirrored on `CheckoutSessionHold` (#360).
 */
export interface HoldRequest {
  productId: string;
  variantId: string;
  locationId: string;
  qty: number;
}

interface ReservationMeta {
  source?: VariantAdjustmentSource;
  actor?: string;
  reason?: string;
}

/**
 * Atomically increment `reserved` across one or more product/variant/location
 * tuples in a single Firestore transaction.
 *
 * Validates `(qty - reserved) >= requested qty` for each line, accumulating
 * per-product holds so multiple lines against the same SKU compose
 * correctly. Throws `InsufficientStockError` on any shortage — the whole
 * transaction rolls back and no partial holds survive.
 *
 * Recomputes denormalized `inStockAt` / `pickupAt` / `featuredAt` indexes
 * because available stock is now `qty - reserved`.
 *
 * Audit log: writes one row per (variantId, locationId) touched per product
 * to `products/{slug}/adjustments` with source `'order'` (override via meta).
 * Delta is 0 because `qty` is unchanged — the row records the reservation
 * via the before/after snapshots.
 */
export async function holdStock(
  items: HoldRequest[],
  meta: ReservationMeta = {}
): Promise<void> {
  await mutateReservations(items, 'hold', meta);
}

/**
 * Atomic decrement of `reserved` — releases held units back to the available
 * pool. No-op safe when called with already-zero reserved entries (clamps at 0
 * rather than throwing) so callers can release on cancellation/expiry without
 * coordinating with the original hold.
 */
export async function releaseStock(
  items: HoldRequest[],
  meta: ReservationMeta = {}
): Promise<void> {
  await mutateReservations(items, 'release', meta);
}

/**
 * Atomic decrement of BOTH `qty` and `reserved` — used after payment capture
 * to convert a hold into a real stock decrement. Equivalent to (a) the legacy
 * `decrementVariantStock` for `qty` plus (b) `releaseStock` for `reserved`,
 * but guaranteed atomic.
 *
 * If `qty` falls to 0, `availablePickup` and `featured` are cleared (mirrors
 * `decrementVariantStock`). Indexes are recomputed.
 */
export async function commitStock(
  items: HoldRequest[],
  meta: ReservationMeta = {}
): Promise<void> {
  await mutateReservations(items, 'commit', meta);
}

type ReservationOp = 'hold' | 'release' | 'commit';

async function mutateReservations(
  items: HoldRequest[],
  op: ReservationOp,
  meta: ReservationMeta
): Promise<void> {
  if (items.length === 0) return;

  const db = getAdminFirestore();
  const slugs = [...new Set(items.map(i => i.productId))];

  await db.runTransaction(async tx => {
    const refs = slugs.map(s => productsCol().doc(s));
    const snaps = await Promise.all(refs.map(r => tx.get(r)));

    const working = new Map<
      string,
      {
        ref: FirebaseFirestore.DocumentReference;
        data: FirebaseFirestore.DocumentData;
        variantSpecs: { [variantId: string]: ProductVariantSpec };
        beforeMap: Map<string, ProductVariantLocation | null>;
      }
    >();

    for (let i = 0; i < slugs.length; i++) {
      const snap = snaps[i];
      if (!snap.exists) {
        throw new Error(`Product '${slugs[i]}' not found`);
      }
      const data = snap.data() ?? {};
      const variantSpecs = readVariantSpecs(data) ?? {};
      working.set(slugs[i], {
        ref: refs[i],
        data,
        variantSpecs,
        beforeMap: new Map(),
      });
    }

    for (const item of items) {
      const w = working.get(item.productId);
      if (!w) {
        throw new Error(`Product '${item.productId}' not loaded`);
      }
      const variant = w.variantSpecs[item.variantId];
      if (!variant) {
        throw new Error(
          `Variant '${item.variantId}' not found on product '${item.productId}'`
        );
      }
      const loc = variant.locations[item.locationId];
      if (!loc) {
        throw new Error(
          `Location '${item.locationId}' not found on variant '${item.variantId}' of '${item.productId}'`
        );
      }

      const beforeKey = `${item.variantId}::${item.locationId}`;
      if (!w.beforeMap.has(beforeKey)) {
        w.beforeMap.set(beforeKey, { ...loc });
      }

      const reserved = loc.reserved ?? 0;
      let nextLoc: ProductVariantLocation;

      if (op === 'hold') {
        const available = loc.qty - reserved;
        if (available < item.qty) {
          throw new InsufficientStockError(
            item.locationId,
            item.productId,
            available,
            item.qty,
            item.variantId
          );
        }
        nextLoc = { ...loc, reserved: reserved + item.qty };
      } else if (op === 'release') {
        // Clamp at 0 — release is idempotent / no-op-safe.
        const nextReserved = Math.max(0, reserved - item.qty);
        nextLoc = { ...loc, reserved: nextReserved };
      } else {
        // commit: decrement qty AND reserved atomically.
        if (loc.qty < item.qty) {
          throw new InsufficientStockError(
            item.locationId,
            item.productId,
            loc.qty,
            item.qty,
            item.variantId
          );
        }
        const nextQty = loc.qty - item.qty;
        const nextReserved = Math.max(0, reserved - item.qty);
        nextLoc = {
          ...loc,
          qty: nextQty,
          reserved: nextReserved,
          ...(nextQty === 0
            ? { availablePickup: false, featured: false }
            : {}),
        };
      }

      w.variantSpecs[item.variantId] = {
        ...variant,
        locations: { ...variant.locations, [item.locationId]: nextLoc },
      };
    }

    const now = new Date();

    for (const [slug, w] of working) {
      const indexes = recomputeIndexes(w.variantSpecs);
      tx.set(
        w.ref,
        {
          variantSpecs: w.variantSpecs,
          inStockAt: indexes.inStockAt,
          pickupAt: indexes.pickupAt,
          featuredAt: indexes.featuredAt,
          updatedAt: now,
        },
        { merge: true }
      );

      for (const [beforeKey, before] of w.beforeMap) {
        const [variantId, locationId] = beforeKey.split('::');
        const after =
          w.variantSpecs[variantId]?.locations[locationId] ?? null;
        const logRef = w.ref.collection('adjustments').doc();
        tx.create(logRef, {
          slug,
          variantId,
          locationId,
          before,
          after,
          delta: (after?.qty ?? 0) - (before?.qty ?? 0),
          source: meta.source ?? 'order',
          actor: meta.actor,
          reason: meta.reason ?? `stock-${op}`,
          createdAt: now,
        } satisfies VariantAdjustmentLog);
      }
    }
  });
}
