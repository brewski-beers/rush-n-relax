import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { LOCATION_SLUGS } from '@/lib/fixtures/storefront';
import type { InventoryItem } from '@/types';

/**
 * GET /api/cart/availability
 *
 * Query params:
 *   items — JSON-encoded array of { productId: string; variantId: string }
 *
 * Returns per-location pickup eligibility for all retail locations.
 * A location is eligible only when:
 *   - The InventoryItem exists and availablePickup === true
 *   - variantPricing[variantId]?.inStock !== false (absent = in stock)
 *
 * Response shape:
 * {
 *   locations: {
 *     [locationSlug]: {
 *       available: boolean;
 *       unavailableItems: string[]; // productIds that blocked this location
 *     }
 *   }
 * }
 *
 * Performance: uses db.getAll() per location to batch all item reads into
 * L round trips (one per retail location) instead of L × N serial reads.
 */

interface CartItemInput {
  productId: string;
  variantId: string;
}

// Retail slugs only — online is not a pickup location
const RETAIL_SLUGS = LOCATION_SLUGS.filter(s => s !== 'online');

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('items');
  if (!raw) {
    return NextResponse.json({ error: 'Missing items param' }, { status: 400 });
  }

  let cartItems: CartItemInput[];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (i: unknown) =>
          !i ||
          typeof i !== 'object' ||
          !('productId' in i) ||
          !('variantId' in i) ||
          typeof (i as Record<string, unknown>).productId !== 'string' ||
          typeof (i as Record<string, unknown>).variantId !== 'string'
      )
    ) {
      throw new Error('Invalid shape');
    }
    cartItems = parsed as CartItemInput[];
  } catch {
    return NextResponse.json({ error: 'Invalid items param' }, { status: 400 });
  }

  if (cartItems.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  const db = getAdminFirestore();

  // One batch read per retail location instead of L × N serial reads.
  const locationResults = await Promise.all(
    RETAIL_SLUGS.map(async locationSlug => {
      const refs = cartItems.map(({ productId }) =>
        db.collection(`inventory/${locationSlug}/items`).doc(productId)
      );

      // getAll returns snapshots in the same order as refs
      const snaps = await db.getAll(...refs);

      const unavailableItems: string[] = [];

      for (let i = 0; i < cartItems.length; i++) {
        const { productId, variantId } = cartItems[i];
        const snap = snaps[i];

        if (!snap.exists) {
          unavailableItems.push(productId);
          continue;
        }

        const d = snap.data() as Record<string, unknown>;
        const inv = docToPartialInventory(d);

        if (!inv.availablePickup) {
          unavailableItems.push(productId);
          continue;
        }

        // variantPricing absence means "not yet configured" — treat as unavailable
        const variantEntry = inv.variantPricing?.[variantId];
        if (!variantEntry || variantEntry.inStock === false) {
          unavailableItems.push(productId);
        }
      }

      return {
        locationSlug,
        available: unavailableItems.length === 0,
        unavailableItems,
      };
    })
  );

  const locations: Record<
    string,
    { available: boolean; unavailableItems: string[] }
  > = {};
  for (const { locationSlug, available, unavailableItems } of locationResults) {
    locations[locationSlug] = { available, unavailableItems };
  }

  return NextResponse.json(
    { locations },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}

// ── Private helpers ───────────────────────────────────────────────────────

/**
 * Extracts only the availability fields needed for cart checks.
 * Mirrors the invariants in inventory.repository: inStock=false forces
 * availablePickup to false regardless of the stored field value.
 */
function docToPartialInventory(
  d: Record<string, unknown>
): Pick<InventoryItem, 'availablePickup' | 'variantPricing'> {
  const rawQty = d.quantity;
  const quantity =
    typeof rawQty === 'number' && Number.isFinite(rawQty)
      ? Math.max(0, Math.floor(rawQty))
      : d.inStock
        ? 1
        : 0;
  const inStock = quantity > 0;
  // Cast through boolean — d.availablePickup is unknown
  const availablePickup: boolean = inStock ? Boolean(d.availablePickup) : false;

  // Defensively map variantPricing (mirrors inventory.repository)
  let variantPricing: InventoryItem['variantPricing'];
  const rawPricing = d.variantPricing;
  if (
    rawPricing &&
    typeof rawPricing === 'object' &&
    !Array.isArray(rawPricing)
  ) {
    const result: NonNullable<InventoryItem['variantPricing']> = {};
    let hasEntry = false;
    for (const [variantId, entry] of Object.entries(
      rawPricing as Record<string, unknown>
    )) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.price !== 'number') continue;
      result[variantId] = {
        price: e.price,
        compareAtPrice:
          typeof e.compareAtPrice === 'number' ? e.compareAtPrice : undefined,
        inStock: typeof e.inStock === 'boolean' ? e.inStock : undefined,
      };
      hasEntry = true;
    }
    if (hasEntry) variantPricing = result;
  }

  return { availablePickup, variantPricing };
}
