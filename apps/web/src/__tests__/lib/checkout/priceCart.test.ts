import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types';

const { getProductBySlugMock } = vi.hoisted(() => ({
  getProductBySlugMock: vi.fn(),
}));

vi.mock('@/lib/repositories/product.repository', () => ({
  getProductBySlug: getProductBySlugMock,
}));

import { priceCart, StaleCartError } from '@/lib/checkout/priceCart';
import { TN_SALES_TAX_RATE } from '@/constants/tax';

/** Build a minimal product doc good enough for `priceCart`. */
function product(opts: {
  slug: string;
  name: string;
  defaultPrice?: number;
  variants?: Record<string, Record<string, { qty: number; price?: number }>>;
}): Product {
  const variants = Object.fromEntries(
    Object.entries(opts.variants ?? {}).map(([variantId, locations]) => [
      variantId,
      {
        label: variantId,
        locations: Object.fromEntries(
          Object.entries(locations).map(([locId, loc]) => [
            locId,
            // `price` is required on the type but real docs can lack it;
            // priceCart must tolerate that, so we deliberately omit it here.
            loc.price === undefined
              ? { qty: loc.qty }
              : { qty: loc.qty, price: loc.price },
          ])
        ),
      },
    ])
  );
  // Justified cast: tests only exercise the fields priceCart reads.
  return {
    id: opts.slug,
    slug: opts.slug,
    name: opts.name,
    ...(opts.defaultPrice !== undefined ? { price: opts.defaultPrice } : {}),
    variants,
  } as unknown as Product;
}

describe('priceCart — server-authoritative cart re-pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes line totals, subtotal, tax (flat TN rate) and total from current product prices', async () => {
    getProductBySlugMock.mockResolvedValue(
      product({
        slug: 'widget',
        name: 'Widget',
        defaultPrice: 999,
        variants: { default: { online: { qty: 10, price: 500 } } },
      })
    );

    const priced = await priceCart(
      [{ productId: 'widget', variantId: 'default', quantity: 2 }],
      'online'
    );

    expect(priced.items).toEqual([
      {
        productId: 'widget',
        variantId: 'default',
        productName: 'Widget',
        quantity: 2,
        unitPrice: 500, // per-location variant price, NOT the 999 default
        lineTotal: 1000,
      },
    ]);
    expect(priced.subtotal).toBe(1000);
    expect(priced.tax).toBe(Math.round(1000 * TN_SALES_TAX_RATE)); // 93
    expect(priced.total).toBe(1000 + Math.round(1000 * TN_SALES_TAX_RATE));
  });

  it('sums multiple lines and dedupes product fetches across variants of the same product', async () => {
    getProductBySlugMock.mockResolvedValue(
      product({
        slug: 'widget',
        name: 'Widget',
        variants: {
          small: { online: { qty: 5, price: 300 } },
          large: { online: { qty: 5, price: 800 } },
        },
      })
    );

    const priced = await priceCart(
      [
        { productId: 'widget', variantId: 'small', quantity: 3 }, // 900
        { productId: 'widget', variantId: 'large', quantity: 1 }, // 800
      ],
      'online'
    );

    expect(getProductBySlugMock).toHaveBeenCalledTimes(1); // deduped
    expect(priced.subtotal).toBe(1700);
    expect(priced.tax).toBe(Math.round(1700 * TN_SALES_TAX_RATE));
    expect(priced.total).toBe(1700 + Math.round(1700 * TN_SALES_TAX_RATE));
  });

  it('falls back to the product default price when the variant/location entry has no price', async () => {
    getProductBySlugMock.mockResolvedValue(
      product({
        slug: 'widget',
        name: 'Widget',
        defaultPrice: 700,
        variants: { default: { online: { qty: 4 } } }, // no price on the location
      })
    );

    const priced = await priceCart(
      [{ productId: 'widget', variantId: 'default', quantity: 1 }],
      'online'
    );
    expect(priced.items[0].unitPrice).toBe(700);
    expect(priced.subtotal).toBe(700);
  });

  it('throws StaleCartError when the product no longer exists', async () => {
    getProductBySlugMock.mockResolvedValue(null);
    await expect(
      priceCart(
        [{ productId: 'gone', variantId: 'default', quantity: 1 }],
        'online'
      )
    ).rejects.toBeInstanceOf(StaleCartError);
    await expect(
      priceCart(
        [{ productId: 'gone', variantId: 'default', quantity: 1 }],
        'online'
      )
    ).rejects.toMatchObject({ productId: 'gone', variantId: 'default' });
  });

  it('throws StaleCartError when there is no usable price (no variant/location price AND no product default)', async () => {
    getProductBySlugMock.mockResolvedValue(
      product({
        slug: 'widget',
        name: 'Widget',
        // no defaultPrice
        variants: { default: { online: { qty: 4 } } }, // no price either
      })
    );
    await expect(
      priceCart(
        [{ productId: 'widget', variantId: 'default', quantity: 1 }],
        'online'
      )
    ).rejects.toBeInstanceOf(StaleCartError);
  });
});
