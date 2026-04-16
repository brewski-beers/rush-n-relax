import { NextRequest, NextResponse } from 'next/server';
import { getInventoryItem } from '@/lib/repositories/inventory.repository';
import { LOCATION_SLUGS } from '@/lib/fixtures/storefront';

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
 */

interface CartItemInput {
  productId: string;
  variantId: string;
}

// Retail slugs only — hub and online are not pickup locations
const RETAIL_SLUGS = LOCATION_SLUGS.filter(s => s !== 'hub' && s !== 'online');

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

  // Fan out: for each retail location, check all cart items in parallel
  const locationResults = await Promise.all(
    RETAIL_SLUGS.map(async locationSlug => {
      const unavailableItems: string[] = [];

      await Promise.all(
        cartItems.map(async ({ productId, variantId }) => {
          const inv = await getInventoryItem(locationSlug, productId);

          if (!inv || !inv.availablePickup) {
            unavailableItems.push(productId);
            return;
          }

          // variantPricing absence means "not yet configured" — treat as unavailable
          const variantEntry = inv.variantPricing?.[variantId];
          if (!variantEntry || variantEntry.inStock === false) {
            unavailableItems.push(productId);
          }
        })
      );

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

  return NextResponse.json({ locations });
}
