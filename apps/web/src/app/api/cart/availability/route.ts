import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { LOCATION_SLUGS } from '@/lib/fixtures/storefront';

/**
 * GET /api/cart/availability
 *
 * Query params:
 *   items — JSON-encoded array of { productId: string; variantId: string }
 *
 * Returns per-location pickup eligibility for all retail locations.
 *
 * Eligibility (post-#312, inventory folded into product.variantSpecs):
 *   - The product document exists and has a `variantSpecs[variantId]` entry
 *     for this `locationId`
 *   - That entry's `availablePickup === true`
 *   - That entry has available stock (qty - reserved > 0)
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
 * Performance: one batched `getAll` per call — products are fetched once
 * and reused across every retail location.
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

  // Single batched read of every cart product — same docs are reused across
  // each retail location's eligibility evaluation.
  const productRefs = cartItems.map(({ productId }) =>
    db.collection('products').doc(productId)
  );
  const productSnaps = await db.getAll(...productRefs);

  const locations: Record<
    string,
    { available: boolean; unavailableItems: string[] }
  > = {};

  for (const locationSlug of RETAIL_SLUGS) {
    const unavailableItems: string[] = [];

    for (let i = 0; i < cartItems.length; i++) {
      const { productId, variantId } = cartItems[i];
      const snap = productSnaps[i];

      if (!snap.exists) {
        unavailableItems.push(productId);
        continue;
      }

      const d = snap.data();
      const loc = readVariantLocation(d, variantId, locationSlug);

      if (!loc) {
        unavailableItems.push(productId);
        continue;
      }

      const available = (loc.qty ?? 0) - (loc.reserved ?? 0);
      if (loc.availablePickup !== true || available <= 0) {
        unavailableItems.push(productId);
      }
    }

    locations[locationSlug] = {
      available: unavailableItems.length === 0,
      unavailableItems,
    };
  }

  return NextResponse.json(
    { locations },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}

// ── Private helpers ───────────────────────────────────────────────────────

interface VariantLocationFields {
  qty?: number;
  reserved?: number;
  availablePickup?: boolean;
}

/**
 * Defensively reads `variantSpecs[variantId].locations[locationId]` from a
 * product document. Returns null when any segment of the path is missing or
 * malformed.
 */
function readVariantLocation(
  d: Record<string, unknown> | undefined,
  variantId: string,
  locationId: string
): VariantLocationFields | null {
  if (!d) return null;
  const specs = d.variantSpecs;
  if (!specs || typeof specs !== 'object') return null;
  const variant = (specs as Record<string, unknown>)[variantId];
  if (!variant || typeof variant !== 'object') return null;
  const locs = (variant as Record<string, unknown>).locations;
  if (!locs || typeof locs !== 'object') return null;
  const loc = (locs as Record<string, unknown>)[locationId];
  if (!loc || typeof loc !== 'object') return null;
  const e = loc as Record<string, unknown>;
  return {
    qty: typeof e.qty === 'number' ? e.qty : undefined,
    reserved: typeof e.reserved === 'number' ? e.reserved : undefined,
    availablePickup:
      typeof e.availablePickup === 'boolean' ? e.availablePickup : undefined,
  };
}
