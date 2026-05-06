/**
 * Product repository — all Firestore access for product documents.
 * Server-side only (uses firebase-admin).
 */
import { cache } from 'react';
import {
  getAdminFirestore,
  toDate,
  ONLINE_LOCATION_ID,
} from '@/lib/firebase/admin';
import type {
  Product,
  ProductVariant,
  ProductVariantLocation,
  LegacyProductVariant,
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

export const getProductBySlug = cache(
  async (slug: string): Promise<Product | null> => {
    const doc = await productsCol().doc(slug).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (!data) return null;
    return docToProduct(doc.id, data);
  }
);

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

export async function getRelatedProducts(
  excludeSlug: string,
  category: string,
  limit = 6
): Promise<ProductSummary[]> {
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

/**
 * Upsert a product document. Self-pruning (#398): when the caller supplies
 * a `variants` map OR the existing document has any legacy variant fields
 * (`variantGroups`-only stays untouched here — it's still authored), we
 *
 *   1. Read the existing document.
 *   2. Project any legacy fields onto the unified `variants` map.
 *   3. Merge any supplied `variants` (preserving existing per-location data
 *      — qty / price / compareAtPrice / availablePickup / featured /
 *      reserved — when the caller seeds an entry with empty locations).
 *   4. Recompute denormalized indexes (`inStockAt` / `pickupAt` /
 *      `featuredAt`).
 *   5. Delete the legacy alias fields (`legacyVariants`, `variantSpecs`)
 *      via `FieldValue.delete()` in the same write.
 *
 * `variantGroups` (option-group definitions used by the storefront PDP for
 * the multi-dimensional selector) is NOT pruned here — it remains an
 * authored field on the product doc. Step 4 (#399) will migrate the PDP
 * away from it.
 */
export async function upsertProduct(
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = productsCol();
  const ref = col.doc(data.slug);
  const now = new Date();

  const existingSnap = await ref.get();
  const existingData = existingSnap.exists ? (existingSnap.data() ?? {}) : {};
  const existingVariants = projectVariants(existingData) ?? {};

  // Caller-supplied `variants` (unified map). May be undefined when the
  // caller doesn't touch variants this round (e.g. status-only edits).
  const suppliedVariants = data.variants;

  // Build the next unified variants map by merging supplied entries onto
  // the existing projected map. Per-location data on the existing entry is
  // preserved when the caller passes an empty `locations` payload for that
  // variantId — this is how the editor seeds new variants without
  // clobbering admin-managed stock.
  let nextVariants: { [variantId: string]: ProductVariant } | undefined;
  if (suppliedVariants !== undefined) {
    const merged: { [variantId: string]: ProductVariant } = {};
    for (const [variantId, v] of Object.entries(suppliedVariants)) {
      const existing = existingVariants[variantId];
      const locations =
        Object.keys(v.locations ?? {}).length === 0 && existing
          ? existing.locations
          : v.locations;
      merged[variantId] = { label: v.label, locations: locations ?? {} };
    }
    nextVariants = merged;
  }

  const { FieldValue } = await import('firebase-admin/firestore');
  const payload: Record<string, unknown> = stripUndefinedFields({
    ...data,
    updatedAt: now,
  });

  if (nextVariants !== undefined) {
    payload.variants = nextVariants;
    const indexes = recomputeProductIndexes(nextVariants);
    payload.inStockAt = indexes.inStockAt;
    payload.pickupAt = indexes.pickupAt;
    payload.featuredAt = indexes.featuredAt;
  }

  // Self-prune legacy alias fields when present on the existing doc.
  if (existingData.legacyVariants !== undefined) {
    payload.legacyVariants = FieldValue.delete();
  }
  if (existingData.variantSpecs !== undefined) {
    payload.variantSpecs = FieldValue.delete();
  }

  await ref.set(payload, { merge: true });
  return data.slug;
}

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
  const variants = projectVariants(d);
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
    legacyVariants:
      docToLegacyVariants(d.legacyVariants) ?? docToLegacyVariants(d.variants),
    variantGroups: docToVariantGroups(d.variantGroups),
    leaflyUrl: d.leaflyUrl ?? undefined,
    variants,
    inStockAt: Array.isArray(d.inStockAt)
      ? (d.inStockAt as string[])
      : undefined,
    featuredAt: Array.isArray(d.featuredAt)
      ? (d.featuredAt as string[])
      : undefined,
  } satisfies ProductSummary;
}

function docToProduct(id: string, d: FirebaseFirestore.DocumentData): Product {
  const variants = projectVariants(d);
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
    legacyVariants:
      docToLegacyVariants(d.legacyVariants) ?? docToLegacyVariants(d.variants),
    extractionType:
      typeof d.extractionType === 'string' ? d.extractionType : undefined,
    hardwareType:
      typeof d.hardwareType === 'string' ? d.hardwareType : undefined,
    volumeMl: typeof d.volumeMl === 'number' ? d.volumeMl : undefined,
    thcMgPerServing:
      typeof d.thcMgPerServing === 'number' ? d.thcMgPerServing : undefined,
    cbdMgPerServing:
      typeof d.cbdMgPerServing === 'number' ? d.cbdMgPerServing : undefined,
    variants,
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
  const r = raw as Record<string, unknown>;
  return {
    thcPercent: typeof r.thcPercent === 'number' ? r.thcPercent : undefined,
    cbdPercent: typeof r.cbdPercent === 'number' ? r.cbdPercent : undefined,
    terpenes: Array.isArray(r.terpenes) ? (r.terpenes as string[]) : undefined,
    testDate: typeof r.testDate === 'string' ? r.testDate : undefined,
    labName: typeof r.labName === 'string' ? r.labName : undefined,
  };
}

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
 * Defensively read the legacy array-shaped `variants` field. Returns
 * undefined when the field is absent OR when it's already the unified map
 * shape (post-self-pruning).
 */
function docToLegacyVariants(raw: unknown): LegacyProductVariant[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid: LegacyProductVariant[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const v = item as Record<string, unknown>;
    if (typeof v.variantId !== 'string' || typeof v.label !== 'string')
      continue;
    const variant: LegacyProductVariant = {
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

// ── Variant model unification (#396) ──────────────────────────────────────

/**
 * Thrown when a transactional decrement detects fewer units available than
 * requested. The whole transaction is rolled back when this error is thrown,
 * so no partial writes survive.
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

export type VariantAdjustmentSource = 'admin' | 'order' | 'reconcile' | 'seed';

interface VariantAdjustmentLog {
  slug: string;
  variantId: string;
  locationId: string;
  before: ProductVariantLocation | null;
  after: ProductVariantLocation | null;
  delta: number;
  source: VariantAdjustmentSource;
  actor?: string;
  reason?: string;
  createdAt: Date;
}

/**
 * Read a single `ProductVariantLocation` defensively from raw Firestore
 * data. Returns null when the entry is malformed (missing required `qty`/
 * `price`).
 *
 * Critically, this preserves `reserved` — the in-flight CheckoutSession
 * hold counter — so the legacy → unified projection performed by every
 * write path does not silently release held units.
 */
function readLocation(raw: unknown): ProductVariantLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const loc = raw as Record<string, unknown>;
  if (typeof loc.qty !== 'number' || typeof loc.price !== 'number') return null;
  const out: ProductVariantLocation = {
    qty: loc.qty,
    price: loc.price,
  };
  if (typeof loc.reserved === 'number') out.reserved = loc.reserved;
  if (typeof loc.compareAtPrice === 'number')
    out.compareAtPrice = loc.compareAtPrice;
  if (typeof loc.availablePickup === 'boolean')
    out.availablePickup = loc.availablePickup;
  if (typeof loc.featured === 'boolean') out.featured = loc.featured;
  return out;
}

/**
 * Project any combination of legacy fields (`variantGroups`,
 * `legacyVariants` / `variants` array, `variantSpecs`) AND the canonical
 * `variants` map into a single unified `variants` map.
 *
 * Precedence (entries from earlier sources win on collision so any data
 * already migrated to the canonical field is the source of truth):
 *   1. `variants` (canonical map) — wins on label and locations
 *   2. `variantSpecs` (deprecated map alias) — fills gaps
 *   3. legacy array `variants` / `legacyVariants` — provides labels for
 *      ids that exist in the maps; bootstraps empty entries for ids that
 *      only appear in the array (rare; defensive)
 *   4. `variantGroups` — bootstraps empty entries via SKU expansion when no
 *      map data exists for the resulting ids (defensive; the editor
 *      typically expands these into the map at save time)
 *
 * Per-location precedence within a variantId: canonical map → variantSpecs
 * — qty / price / compareAtPrice / availablePickup / featured / reserved
 * are all preserved from whichever source is authoritative.
 */
function projectVariants(
  d: FirebaseFirestore.DocumentData
): { [variantId: string]: ProductVariant } | undefined {
  const out: { [variantId: string]: ProductVariant } = {};

  const ingestMap = (raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    for (const [variantId, v] of Object.entries(
      raw as Record<string, unknown>
    )) {
      if (!v || typeof v !== 'object') continue;
      const variant = v as Record<string, unknown>;
      if (typeof variant.label !== 'string') continue;
      const existing = out[variantId];
      const locations: { [locationId: string]: ProductVariantLocation } =
        existing ? { ...existing.locations } : {};
      if (variant.locations && typeof variant.locations === 'object') {
        for (const [locId, locRaw] of Object.entries(
          variant.locations as Record<string, unknown>
        )) {
          if (locations[locId]) continue; // earlier source wins
          const parsed = readLocation(locRaw);
          if (parsed) locations[locId] = parsed;
        }
      }
      if (existing) {
        existing.locations = locations;
      } else {
        out[variantId] = { label: variant.label, locations };
      }
    }
  };

  // 1. canonical map
  ingestMap(d.variants);
  // 2. deprecated alias map
  ingestMap(d.variantSpecs);

  // 3. legacy array — supplies labels and bootstraps id-only entries.
  // Read from both `variants` (pre-#396 field name) and `legacyVariants`
  // (new field name written by step-1 admin actions until step 3 migrates
  // the editor onto the unified map).
  const legacyArr =
    docToLegacyVariants(d.legacyVariants) ?? docToLegacyVariants(d.variants);
  if (legacyArr) {
    for (const v of legacyArr) {
      if (!out[v.variantId]) {
        out[v.variantId] = { label: v.label, locations: {} };
      }
    }
  }

  // 4. variantGroups — last-resort SKU expansion for ids missing from maps
  const groups = docToVariantGroups(d.variantGroups);
  if (groups) {
    for (const sku of expandGroupsToSkus(groups)) {
      if (!out[sku.variantId]) {
        out[sku.variantId] = { label: sku.label, locations: {} };
      }
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Cartesian-product expansion of variantGroups into (variantId, label)
 * tuples. Mirrors `lib/variants/generateSkus.ts` exactly but is duplicated
 * here so the repo has zero outbound dependencies on storefront helpers.
 * Step 3 (#398) deletes both copies once the editor authors the unified
 * map directly.
 */
function expandGroupsToSkus(
  groups: VariantGroup[]
): { variantId: string; label: string }[] {
  const combinable = groups.filter(g => g.combinable && g.options.length > 0);
  const standalone = groups.filter(g => !g.combinable && g.options.length > 0);
  const result: { variantId: string; label: string }[] = [];
  for (const g of standalone) {
    for (const opt of g.options) {
      result.push({ variantId: opt.optionId, label: opt.label });
    }
  }
  if (combinable.length > 0) {
    let matrix: VariantOption[][] = [[]];
    for (const g of combinable) {
      matrix = matrix.flatMap(combo => g.options.map(opt => [...combo, opt]));
    }
    for (const combo of matrix) {
      result.push({
        variantId: combo.map(o => o.optionId).join('-'),
        label: combo.map(o => o.label).join(' | '),
      });
    }
  }
  return result;
}

/**
 * Recompute the denormalized `inStockAt` / `pickupAt` / `featuredAt`
 * arrays from the unified `variants` map. Pure function — no I/O.
 *
 * Available stock is `qty - (reserved ?? 0)` — a SKU whose units are all
 * held by in-flight CheckoutSessions does NOT contribute to any index.
 */
export function recomputeProductIndexes(
  variants: { [variantId: string]: ProductVariant } | undefined
): { inStockAt: string[]; pickupAt: string[]; featuredAt: string[] } {
  const inStockAt = new Set<string>();
  const pickupAt = new Set<string>();
  const featuredAt = new Set<string>();

  if (!variants) {
    return { inStockAt: [], pickupAt: [], featuredAt: [] };
  }

  for (const variant of Object.values(variants)) {
    if (!variant?.locations) continue;
    for (const [locationId, loc] of Object.entries(variant.locations)) {
      if (!loc || typeof loc.qty !== 'number') continue;
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
 * Build the Firestore set/merge payload for a self-pruning write. Returns
 * an object ready to pass to `tx.set(ref, payload, { merge: true })`. Sets
 * the unified `variants` map + recomputed indexes + `updatedAt`, and uses
 * `FieldValue.delete()` sentinels to physically remove `variantGroups`,
 * the array-shaped `variants` (when present), and `variantSpecs` from the
 * stored doc in the same atomic write.
 */
async function buildSelfPruningPayload(
  data: FirebaseFirestore.DocumentData,
  nextVariants: { [variantId: string]: ProductVariant },
  now: Date
): Promise<Record<string, unknown>> {
  const { FieldValue } = await import('firebase-admin/firestore');
  const indexes = recomputeProductIndexes(nextVariants);
  const payload: Record<string, unknown> = {
    variants: nextVariants,
    inStockAt: indexes.inStockAt,
    pickupAt: indexes.pickupAt,
    featuredAt: indexes.featuredAt,
    updatedAt: now,
  };
  // Self-prune legacy fields when present on the existing doc. Skipping the
  // delete when absent keeps the set payload tight (no unnecessary writes).
  if (data.variantGroups !== undefined) {
    payload.variantGroups = FieldValue.delete();
  }
  // The array-shape `variants` field is overwritten atomically by setting
  // `payload.variants` to the unified map above — Firestore replaces the
  // value entirely, so no FieldValue.delete is needed for that path.
  if (data.legacyVariants !== undefined) {
    payload.legacyVariants = FieldValue.delete();
  }
  if (data.variantSpecs !== undefined) {
    payload.variantSpecs = FieldValue.delete();
  }
  return payload;
}

/**
 * Set or replace a single variant/location entry on a product.
 *
 * Self-pruning (#396): projects any legacy fields onto the unified
 * `variants` map and prunes them in the same Firestore write. Recomputes
 * the denormalized indexes and writes an audit-log doc under
 * `products/{slug}/adjustments`.
 *
 * Throws when the product does not exist or when the resolved
 * `variants[variantId]` is missing — this helper does not bootstrap new
 * variants (the catalog editor is responsible for creating them).
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
    const variants = projectVariants(data) ?? {};
    const existingVariant = variants[variantId];
    if (!existingVariant) {
      throw new Error(`Variant '${variantId}' not found on product '${slug}'`);
    }

    const before = existingVariant.locations[locationId] ?? null;
    const nextLocations = { ...existingVariant.locations, [locationId]: patch };
    const nextVariants: { [variantId: string]: ProductVariant } = {
      ...variants,
      [variantId]: { ...existingVariant, locations: nextLocations },
    };

    const now = new Date();
    const payload = await buildSelfPruningPayload(data, nextVariants, now);
    tx.set(ref, payload, { merge: true });

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

    const indexes = recomputeProductIndexes(nextVariants);
    return docToProduct(snap.id, {
      ...data,
      variants: nextVariants,
      variantSpecs: undefined,
      variantGroups: undefined,
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
 * Self-prunes legacy fields on every touched product (#396).
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
  const slugs = [...new Set(items.map(i => i.slug))];

  await db.runTransaction(async tx => {
    const refs = slugs.map(s => productsCol().doc(s));
    const snaps = await Promise.all(refs.map(r => tx.get(r)));

    const working = new Map<
      string,
      {
        ref: FirebaseFirestore.DocumentReference;
        data: FirebaseFirestore.DocumentData;
        variants: { [variantId: string]: ProductVariant };
        beforeMap: Map<string, ProductVariantLocation | null>;
      }
    >();

    for (let i = 0; i < slugs.length; i++) {
      const snap = snaps[i];
      if (!snap.exists) {
        throw new Error(`Product '${slugs[i]}' not found`);
      }
      const data = snap.data() ?? {};
      const variants = projectVariants(data) ?? {};
      working.set(slugs[i], {
        ref: refs[i],
        data,
        variants,
        beforeMap: new Map(),
      });
    }

    for (const item of items) {
      const w = working.get(item.slug);
      if (!w) {
        throw new Error(`Product '${item.slug}' not loaded`);
      }
      const variant = w.variants[item.variantId];
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
      const beforeKey = `${item.variantId}::${item.locationId}`;
      if (!w.beforeMap.has(beforeKey)) {
        w.beforeMap.set(beforeKey, { ...loc });
      }

      const nextQty = available - item.qty;
      const nextLoc: ProductVariantLocation = {
        ...loc,
        qty: nextQty,
        ...(nextQty === 0 ? { availablePickup: false, featured: false } : {}),
      };
      w.variants[item.variantId] = {
        ...variant,
        locations: { ...variant.locations, [item.locationId]: nextLoc },
      };
    }

    const now = new Date();

    for (const [slug, w] of working) {
      const payload = await buildSelfPruningPayload(w.data, w.variants, now);
      tx.set(w.ref, payload, { merge: true });

      for (const [beforeKey, before] of w.beforeMap) {
        const [variantId, locationId] = beforeKey.split('::');
        const after = w.variants[variantId]?.locations[locationId] ?? null;
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

export async function listFeaturedProductsAt(
  locationId: string,
  opts: { limit?: number } = {}
): Promise<ProductSummary[]> {
  const limit = opts.limit ?? 25;
  const snap = await productsCol()
    .where('status', '==', 'active')
    .where('featuredAt', 'array-contains', locationId)
    .orderBy('name')
    .limit(limit)
    .get();
  return snap.docs.map(doc => docToProductSummary(doc.id, doc.data()));
}

export async function getOnlineInStockSet(
  productIds: string[]
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const refs = productIds.map(id => productsCol().doc(id));
  const snaps = await getAdminFirestore().getAll(...refs);
  const result = new Set<string>();
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data();
    const inStockAt = Array.isArray(data?.inStockAt)
      ? (data.inStockAt as string[])
      : [];
    if (inStockAt.includes(ONLINE_LOCATION_ID)) result.add(snap.id);
  }
  return result;
}

// ── Reservation helpers (#361) — money path ───────────────────────────────

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
 * tuples in a single Firestore transaction. Self-pruning: legacy fields on
 * each touched product are projected onto the unified `variants` map and
 * pruned in the same write. CRUCIALLY this preserves any pre-existing
 * `reserved` counts on the legacy variantSpecs entries — losing them would
 * silently release in-flight CheckoutSession holds.
 */
export async function holdStock(
  items: HoldRequest[],
  meta: ReservationMeta = {}
): Promise<void> {
  await mutateReservations(items, 'hold', meta);
}

export async function releaseStock(
  items: HoldRequest[],
  meta: ReservationMeta = {}
): Promise<void> {
  await mutateReservations(items, 'release', meta);
}

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
        variants: { [variantId: string]: ProductVariant };
        beforeMap: Map<string, ProductVariantLocation | null>;
      }
    >();

    for (let i = 0; i < slugs.length; i++) {
      const snap = snaps[i];
      if (!snap.exists) {
        throw new Error(`Product '${slugs[i]}' not found`);
      }
      const data = snap.data() ?? {};
      const variants = projectVariants(data) ?? {};
      working.set(slugs[i], {
        ref: refs[i],
        data,
        variants,
        beforeMap: new Map(),
      });
    }

    for (const item of items) {
      const w = working.get(item.productId);
      if (!w) {
        throw new Error(`Product '${item.productId}' not loaded`);
      }
      const variant = w.variants[item.variantId];
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
        const nextReserved = Math.max(0, reserved - item.qty);
        nextLoc = { ...loc, reserved: nextReserved };
      } else {
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
          ...(nextQty === 0 ? { availablePickup: false, featured: false } : {}),
        };
      }

      w.variants[item.variantId] = {
        ...variant,
        locations: { ...variant.locations, [item.locationId]: nextLoc },
      };
    }

    const now = new Date();

    for (const [slug, w] of working) {
      const payload = await buildSelfPruningPayload(w.data, w.variants, now);
      tx.set(w.ref, payload, { merge: true });

      for (const [beforeKey, before] of w.beforeMap) {
        const [variantId, locationId] = beforeKey.split('::');
        const after = w.variants[variantId]?.locations[locationId] ?? null;
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
