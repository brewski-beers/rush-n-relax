// Run with:
//   npx tsx scripts/migrate-inventory-into-products.ts [--dry-run]
//
// Migration for issue #307 (tracked under #304): folds the legacy
// `inventory/{locationId}/items/{productId}` sub-collection into the new
// per-product variant model:
//
//   products/{slug}.variantSpecs[variantId].locations[locationId] = {
//     qty, price, compareAtPrice?, availablePickup?, featured?,
//   }
//
// Plus the denormalized index arrays `inStockAt` / `pickupAt` / `featuredAt`
// that drive storefront queries (see #306 for the model details).
//
// Source mapping:
//   - InventoryItem.quantity        → variants.default.locations[loc].qty
//                                      (falls back to inStock ? 1 : 0 when
//                                       quantity is unset on legacy docs)
//   - InventoryItem.variantPricing  → variants[variantId].locations[loc].price
//                                      + .compareAtPrice (when present);
//                                      qty mirrors variantPricing[v].inStock
//                                      (true → 1, false → 0)
//   - InventoryItem.availablePickup → locations[loc].availablePickup
//   - InventoryItem.featured        → locations[loc].featured
//
// `default` variant pricing falls back to the parent product's `price` /
// `compareAtPrice` when the inventory doc has no entry. If neither exists,
// the variant is skipped (we cannot manufacture a price).
//
// Idempotent: each run reads the current product state and overwrites only
// the (variantId, locationId) entries that the inventory doc covers. Re-runs
// converge. Inventory docs are NEVER modified — cleanup is tracked under
// #312 (parallel-write window first).
//
// Dry-run mode (--dry-run): logs the per-product diff without committing.
// Defaults to the Firebase emulator at 127.0.0.1:8080 unless
// FIRESTORE_EMULATOR_HOST is already set or RUN_AGAINST_PROD=1.

import { getAdminFirestore } from '../apps/web/src/lib/firebase/admin';

const DRY_RUN = process.argv.includes('--dry-run');

if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.RUN_AGAINST_PROD) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

interface VariantLocationEntry {
  qty: number;
  price: number;
  compareAtPrice?: number;
  availablePickup?: boolean;
  featured?: boolean;
}

interface VariantSpec {
  label: string;
  locations: { [locationId: string]: VariantLocationEntry };
}

type VariantSpecs = { [variantId: string]: VariantSpec };

function recomputeIndexes(specs: VariantSpecs): {
  inStockAt: string[];
  pickupAt: string[];
  featuredAt: string[];
} {
  const inStockAt = new Set<string>();
  const pickupAt = new Set<string>();
  const featuredAt = new Set<string>();
  for (const variant of Object.values(specs)) {
    if (!variant?.locations) continue;
    for (const [locationId, loc] of Object.entries(variant.locations)) {
      if (!loc || typeof loc.qty !== 'number' || loc.qty <= 0) continue;
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

function normalizeVariantSpecs(raw: unknown): VariantSpecs {
  if (!raw || typeof raw !== 'object') return {};
  const out: VariantSpecs = {};
  for (const [variantId, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const variant = v as Record<string, unknown>;
    const label = typeof variant.label === 'string' ? variant.label : variantId;
    const locations: { [locationId: string]: VariantLocationEntry } = {};
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
          price: loc.price,
          ...(typeof loc.compareAtPrice === 'number'
            ? { compareAtPrice: loc.compareAtPrice }
            : {}),
          ...(typeof loc.availablePickup === 'boolean'
            ? { availablePickup: loc.availablePickup }
            : {}),
          ...(typeof loc.featured === 'boolean'
            ? { featured: loc.featured }
            : {}),
        };
      }
    }
    out[variantId] = { label, locations };
  }
  return out;
}

interface InventorySource {
  locationId: string;
  productId: string;
  inStock: boolean;
  quantity?: number;
  availablePickup: boolean;
  featured: boolean;
  variantPricing?: {
    [variantId: string]: {
      price: number;
      compareAtPrice?: number;
      inStock?: boolean;
    };
  };
}

async function loadAllInventory(): Promise<InventorySource[]> {
  const db = getAdminFirestore();
  const snap = await db.collectionGroup('items').get();
  const out: InventorySource[] = [];
  for (const doc of snap.docs) {
    // Only items under inventory/{locationId}/items/{productId}
    const segs = doc.ref.path.split('/');
    if (segs.length !== 4 || segs[0] !== 'inventory' || segs[2] !== 'items') {
      continue;
    }
    const locationId = segs[1];
    const productId = segs[3];
    const d = doc.data();
    out.push({
      locationId,
      productId,
      inStock: typeof d.inStock === 'boolean' ? d.inStock : false,
      quantity: typeof d.quantity === 'number' ? d.quantity : undefined,
      availablePickup:
        typeof d.availablePickup === 'boolean' ? d.availablePickup : false,
      featured: typeof d.featured === 'boolean' ? d.featured : false,
      variantPricing:
        d.variantPricing && typeof d.variantPricing === 'object'
          ? (d.variantPricing as InventorySource['variantPricing'])
          : undefined,
    });
  }
  return out;
}

interface MigrationStats {
  productsTouched: number;
  productsSkipped: number;
  inventoryDocs: number;
  variantLocationEntriesWritten: number;
}

async function migrate(): Promise<MigrationStats> {
  const db = getAdminFirestore();
  const inventory = await loadAllInventory();
  console.log(
    `[migrate] loaded ${inventory.length} inventory doc(s) across all locations`
  );

  // Group by productId — one product write per product.
  const byProduct = new Map<string, InventorySource[]>();
  for (const inv of inventory) {
    const list = byProduct.get(inv.productId) ?? [];
    list.push(inv);
    byProduct.set(inv.productId, list);
  }

  const stats: MigrationStats = {
    productsTouched: 0,
    productsSkipped: 0,
    inventoryDocs: inventory.length,
    variantLocationEntriesWritten: 0,
  };

  for (const [productId, items] of byProduct) {
    const ref = db.collection('products').doc(productId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.warn(
        `[migrate] inventory references missing product '${productId}' — skipping`
      );
      stats.productsSkipped++;
      continue;
    }
    const data = snap.data() ?? {};
    const fallbackPrice = typeof data.price === 'number' ? data.price : null;
    const fallbackCompareAt =
      typeof data.compareAtPrice === 'number'
        ? (data.compareAtPrice as number)
        : null;
    const productVariants =
      data.variants && typeof data.variants === 'object'
        ? (data.variants as Record<string, unknown>)
        : {};

    const specs: VariantSpecs = normalizeVariantSpecs(data.variantSpecs);

    for (const inv of items) {
      // Default variant — derive from quantity + product price.
      const defaultQty =
        typeof inv.quantity === 'number'
          ? inv.quantity
          : inv.inStock
            ? 1
            : 0;
      const defaultPrice = fallbackPrice;
      if (defaultPrice === null) {
        console.warn(
          `[migrate] product '${productId}' has no top-level price; default variant at '${inv.locationId}' skipped`
        );
      } else {
        if (!specs.default) {
          specs.default = { label: 'Default', locations: {} };
        }
        const entry: VariantLocationEntry = {
          qty: defaultQty,
          price: defaultPrice,
          ...(fallbackCompareAt !== null
            ? { compareAtPrice: fallbackCompareAt }
            : {}),
          availablePickup: inv.availablePickup,
          featured: inv.featured,
        };
        specs.default.locations[inv.locationId] = entry;
        stats.variantLocationEntriesWritten++;
      }

      // Per-variant pricing entries.
      if (inv.variantPricing) {
        for (const [variantId, vp] of Object.entries(inv.variantPricing)) {
          if (variantId === 'default') continue; // handled above
          const variantLabelRaw = (
            productVariants[variantId] as { label?: unknown } | undefined
          )?.label;
          const variantLabel =
            typeof variantLabelRaw === 'string' ? variantLabelRaw : variantId;
          if (!specs[variantId]) {
            specs[variantId] = { label: variantLabel, locations: {} };
          }
          const variantQty =
            vp.inStock === false ? 0 : vp.inStock === true ? 1 : defaultQty;
          const entry: VariantLocationEntry = {
            qty: variantQty,
            price: vp.price,
            ...(typeof vp.compareAtPrice === 'number'
              ? { compareAtPrice: vp.compareAtPrice }
              : {}),
            availablePickup: inv.availablePickup,
            featured: inv.featured,
          };
          specs[variantId].locations[inv.locationId] = entry;
          stats.variantLocationEntriesWritten++;
        }
      }
    }

    const indexes = recomputeIndexes(specs);
    const update = {
      variantSpecs: specs,
      inStockAt: indexes.inStockAt,
      pickupAt: indexes.pickupAt,
      featuredAt: indexes.featuredAt,
      updatedAt: new Date(),
    };

    if (DRY_RUN) {
      console.log(
        `[dry-run] would update product '${productId}': ${
          Object.keys(specs).length
        } variant(s); inStockAt=[${indexes.inStockAt.join(
          ', '
        )}] pickupAt=[${indexes.pickupAt.join(
          ', '
        )}] featuredAt=[${indexes.featuredAt.join(', ')}]`
      );
    } else {
      await ref.set(update, { merge: true });
      console.log(
        `[migrate] updated product '${productId}' (${
          Object.keys(specs).length
        } variant(s))`
      );
    }
    stats.productsTouched++;
  }

  return stats;
}

migrate()
  .then(stats => {
    console.log(
      `[migrate] done — products touched=${stats.productsTouched} skipped=${stats.productsSkipped} inventory-docs=${stats.inventoryDocs} entries-written=${stats.variantLocationEntriesWritten}${
        DRY_RUN ? ' (DRY RUN — no writes)' : ''
      }`
    );
    process.exit(0);
  })
  .catch(err => {
    console.error('[migrate] failed:', err);
    process.exit(1);
  });
