import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  setVariantLocationMock,
  getProductBySlugMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  setVariantLocationMock: vi.fn().mockResolvedValue(undefined),
  getProductBySlugMock: vi.fn().mockResolvedValue(null),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  setVariantLocation: setVariantLocationMock,
  getProductBySlug: getProductBySlugMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  setProductVariantStock,
  renameProductVariant,
} from '@/app/(admin)/admin/products/[slug]/edit/stock-actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubOwner() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

function stubUnauthorised() {
  requireRoleMock.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT:/admin/login');
  });
}

interface StubProductOpts {
  variantId?: string;
  locationId?: string;
  qty?: number;
  price?: number;
  availablePickup?: boolean;
  featured?: boolean;
}

function stubProduct(opts: StubProductOpts = {}) {
  const variantId = opts.variantId ?? 'default';
  const locationId = opts.locationId ?? 'oak-ridge';
  getProductBySlugMock.mockResolvedValue({
    id: 'product-a',
    slug: 'product-a',
    name: 'Product A',
    category: 'flower',
    details: '...',
    availableAt: [],
    status: 'active',
    variantSpecs: {
      [variantId]: {
        label: variantId === 'default' ? 'Default' : variantId,
        locations: {
          [locationId]: {
            qty: opts.qty ?? 0,
            price: opts.price ?? 0,
            ...(opts.availablePickup !== undefined && {
              availablePickup: opts.availablePickup,
            }),
            ...(opts.featured !== undefined && { featured: opts.featured }),
          },
        },
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('setProductVariantStock — unified product editor (#311)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setVariantLocationMock.mockResolvedValue(undefined);
    getProductBySlugMock.mockResolvedValue(null);
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect from requireRole', async () => {
      stubUnauthorised();

      await expect(
        setProductVariantStock('product-a', 'default', 'oak-ridge', {
          qty: 5,
          price: 1000,
        })
      ).rejects.toThrow('NEXT_REDIRECT:/admin/login');

      expect(setVariantLocationMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  describe('given the product does not exist', () => {
    it('returns ok:false without writing', async () => {
      stubOwner();
      getProductBySlugMock.mockResolvedValue(null);

      const result = await setProductVariantStock(
        'ghost',
        'default',
        'oak-ridge',
        { qty: 1, price: 100 }
      );

      expect(result).toEqual({
        ok: false,
        error: "Product 'ghost' not found.",
      });
      expect(setVariantLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given the variant does not exist on the product', () => {
    it('returns ok:false without writing', async () => {
      stubOwner();
      stubProduct({ variantId: 'default' });

      const result = await setProductVariantStock(
        'product-a',
        'missing-variant',
        'oak-ridge',
        { qty: 1, price: 100 }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Variant 'missing-variant' not found");
      }
      expect(setVariantLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given a valid stock update', () => {
    it('writes qty/price through setVariantLocation with admin/product-editor metadata', async () => {
      stubOwner();
      stubProduct({ qty: 0, price: 0 });

      const result = await setProductVariantStock(
        'product-a',
        'default',
        'oak-ridge',
        { qty: 7, price: 1500, availablePickup: true }
      );

      expect(result).toEqual({ ok: true });
      expect(setVariantLocationMock).toHaveBeenCalledOnce();
      const [slug, variantId, locId, patch, meta] = setVariantLocationMock.mock
        .calls[0] as [
        string,
        string,
        string,
        {
          qty: number;
          price: number;
          availablePickup?: boolean;
          featured?: boolean;
        },
        { source?: string; actor?: string; reason?: string },
      ];
      expect(slug).toBe('product-a');
      expect(variantId).toBe('default');
      expect(locId).toBe('oak-ridge');
      expect(patch.qty).toBe(7);
      expect(patch.price).toBe(1500);
      expect(patch.availablePickup).toBe(true);
      expect(meta.source).toBe('admin');
      expect(meta.actor).toBe('owner@rushnrelax.com');
      expect(meta.reason).toBe('product-editor');
    });
  });

  describe('given featured=true with qty=0', () => {
    it('rejects with the invariant-violation error', async () => {
      stubOwner();
      stubProduct({ qty: 5, price: 1000 });

      const result = await setProductVariantStock(
        'product-a',
        'default',
        'oak-ridge',
        { qty: 0, price: 1000, featured: true }
      );

      expect(result).toEqual({
        ok: false,
        error: 'Cannot feature an item that is not in stock.',
      });
      expect(setVariantLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given qty=0 with availablePickup/featured set', () => {
    it('forces availablePickup and featured to false', async () => {
      stubOwner();
      stubProduct({ qty: 5, price: 1000 });

      await setProductVariantStock('product-a', 'default', 'oak-ridge', {
        qty: 0,
        price: 1000,
        availablePickup: true,
      });

      const [, , , patch] = setVariantLocationMock.mock.calls[0] as [
        string,
        string,
        string,
        { qty: number; availablePickup?: boolean; featured?: boolean },
      ];
      expect(patch.qty).toBe(0);
      expect(patch.availablePickup).toBe(false);
    });
  });

  describe('given negative or fractional inputs', () => {
    it('clamps qty to non-negative integer and price to non-negative integer', async () => {
      stubOwner();
      stubProduct();

      await setProductVariantStock('product-a', 'default', 'oak-ridge', {
        qty: -3.7,
        price: -100.5,
      });

      const [, , , patch] = setVariantLocationMock.mock.calls[0] as [
        string,
        string,
        string,
        { qty: number; price: number },
      ];
      expect(patch.qty).toBe(0);
      expect(patch.price).toBe(0);
    });
  });

  describe('given setVariantLocation throws', () => {
    it('returns ok:false without revalidating paths', async () => {
      stubOwner();
      stubProduct();
      setVariantLocationMock.mockRejectedValue(new Error('boom'));

      const result = await setProductVariantStock(
        'product-a',
        'default',
        'oak-ridge',
        { qty: 1, price: 100 }
      );

      expect(result).toEqual({ ok: false, error: 'boom' });
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  describe('given a successful update', () => {
    it('revalidates admin + storefront paths', async () => {
      stubOwner();
      stubProduct();

      await setProductVariantStock('product-a', 'default', 'oak-ridge', {
        qty: 3,
        price: 500,
      });

      expect(revalidatePathMock).toHaveBeenCalledWith(
        '/admin/products/product-a/edit'
      );
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/products');
      expect(revalidatePathMock).toHaveBeenCalledWith('/');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products/product-a');
    });
  });
});

describe('renameProductVariant — defers to catalog editor (#311)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an empty label', () => {
    it('returns the empty-label error', async () => {
      stubOwner();
      const result = await renameProductVariant('product-a', 'default', '   ');
      expect(result).toEqual({
        ok: false,
        error: 'Variant label cannot be empty.',
      });
    });
  });

  describe('given a valid label', () => {
    it('returns a friendly message routing the user to the Variants section', async () => {
      stubOwner();
      const result = await renameProductVariant(
        'product-a',
        'default',
        '1/8 oz'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Variants section/i);
      }
    });
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect', async () => {
      stubUnauthorised();
      await expect(
        renameProductVariant('product-a', 'default', 'New Label')
      ).rejects.toThrow('NEXT_REDIRECT:/admin/login');
    });
  });
});
