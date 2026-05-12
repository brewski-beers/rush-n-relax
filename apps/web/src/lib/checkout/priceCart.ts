/**
 * priceCart — server-authoritative cart re-pricing for checkout.
 *
 * The browser sends only `(productId, variantId, quantity)` for each cart
 * line. The server MUST NOT trust any client-supplied unit price, subtotal,
 * tax, or total — a malicious client could POST `subtotal: 1` / `tax: 0`.
 * This helper re-fetches the current price for every line from the product
 * repository, recomputes the line totals, and derives `subtotal`, `tax`
 * (flat TN rate), and `total` from scratch.
 *
 * On any stale-cart condition (unknown product / variant, or a variant with
 * no price at the order's location) it throws {@link StaleCartError} so the
 * caller can release stock holds and return a 400.
 */
import { getProductBySlug } from '@/lib/repositories/product.repository';
import { TN_SALES_TAX_RATE } from '@/constants/tax';
import type { OrderItem } from '@/types';

/** A cart line as received from the client — the only fields we trust. */
export interface CartLineInput {
  productId: string;
  variantId: string;
  quantity: number;
}

/** Thrown when the cart references a product/variant that no longer exists
 *  or has no price at the requested location. */
export class StaleCartError extends Error {
  readonly productId: string;
  readonly variantId: string;
  constructor(message: string, productId: string, variantId: string) {
    super(message);
    this.name = 'StaleCartError';
    this.productId = productId;
    this.variantId = variantId;
  }
}

export interface PricedCart {
  /** Line items rebuilt with server-side prices — safe to persist. */
  items: OrderItem[];
  /** cents */
  subtotal: number;
  /** cents */
  tax: number;
  /** cents */
  total: number;
}

/**
 * Resolve the unit price (cents) for a `(variantId, locationId)` pair on a
 * product doc. Falls back to the product-level default `price` when the
 * variant/location entry exists but carries no price (rare) — returns
 * `undefined` only when there is genuinely no usable price.
 */
function resolveUnitPrice(
  product: Awaited<ReturnType<typeof getProductBySlug>>,
  variantId: string,
  locationId: string
): number | undefined {
  if (!product) return undefined;
  const loc = product.variants?.[variantId]?.locations?.[locationId];
  if (loc && typeof loc.price === 'number') return loc.price;
  if (typeof product.price === 'number') return product.price;
  return undefined;
}

/**
 * Re-price a cart against current product data.
 *
 * @param lines       Trusted-fields-only cart lines (productId/variantId/qty).
 * @param locationId  Fulfilling location slug (variant prices are per-location).
 * @throws StaleCartError when a line references a missing product/variant or
 *         an entry with no price.
 */
export async function priceCart(
  lines: ReadonlyArray<CartLineInput>,
  locationId: string
): Promise<PricedCart> {
  // Dedupe product fetches — a cart can hold several variants of one product.
  const uniqueSlugs = [...new Set(lines.map(l => l.productId))];
  const products = new Map<
    string,
    Awaited<ReturnType<typeof getProductBySlug>>
  >();
  await Promise.all(
    uniqueSlugs.map(async slug => {
      products.set(slug, await getProductBySlug(slug));
    })
  );

  const items: OrderItem[] = [];
  let subtotal = 0;

  for (const line of lines) {
    const variantId = line.variantId || 'default';
    const product = products.get(line.productId) ?? null;
    if (!product) {
      throw new StaleCartError(
        `Product '${line.productId}' is no longer available.`,
        line.productId,
        variantId
      );
    }
    const unitPrice = resolveUnitPrice(product, variantId, locationId);
    if (typeof unitPrice !== 'number') {
      throw new StaleCartError(
        `'${product.name}' (variant '${variantId}') is no longer available at this location.`,
        line.productId,
        variantId
      );
    }
    const lineTotal = unitPrice * line.quantity;
    subtotal += lineTotal;
    items.push({
      productId: line.productId,
      variantId,
      productName: product.name,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
    });
  }

  const tax = Math.round(subtotal * TN_SALES_TAX_RATE);
  const total = subtotal + tax;
  return { items, subtotal, tax, total };
}
