import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  setVariantLocationMock,
  setInventoryItemMock,
  getProductBySlugMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  setVariantLocationMock: vi.fn().mockResolvedValue(undefined),
  setInventoryItemMock: vi.fn().mockResolvedValue(undefined),
  getProductBySlugMock: vi.fn().mockResolvedValue(null),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  setVariantLocation: setVariantLocationMock,
  setInventoryItem: setInventoryItemMock,
  getProductBySlug: getProductBySlugMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { updateInventoryItem } from '@/app/(admin)/admin/inventory/[locationId]/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
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
  qty?: number;
  price?: number;
  availablePickup?: boolean;
  featured?: boolean;
  locationId?: string;
}

function stubProduct(opts: StubProductOpts = {}) {
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
      default: {
        label: 'Default',
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

function stubProductWithoutVariantSpecs() {
  getProductBySlugMock.mockResolvedValue({
    id: 'product-a',
    slug: 'product-a',
    name: 'Product A',
    category: 'flower',
    details: '...',
    availableAt: [],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('updateInventoryItem server action — variantSpecs writes (#358)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setVariantLocationMock.mockResolvedValue(undefined);
    getProductBySlugMock.mockResolvedValue(null);
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect thrown by requireRole', async () => {
      stubUnauthorised();

      await expect(
        updateInventoryItem('oak-ridge', 'product-a', { inStock: true })
      ).rejects.toThrow('NEXT_REDIRECT:/admin/login');

      expect(setVariantLocationMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  describe('given the product does not exist', () => {
    it('returns ok:false without writing', async () => {
      stubAuthorisedActor();
      getProductBySlugMock.mockResolvedValue(null);

      const result = await updateInventoryItem('oak-ridge', 'ghost', {
        inStock: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Product 'ghost' not found");
      }
      expect(setVariantLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given a valid owner toggling inStock=true', () => {
    it("calls setVariantLocation on the 'default' variant with qty>=1", async () => {
      stubAuthorisedActor();
      stubProductWithoutVariantSpecs();

      await updateInventoryItem('oak-ridge', 'product-a', { inStock: true });

      expect(setVariantLocationMock).toHaveBeenCalledOnce();
      const [slug, variantId, locId, patch, meta] =
        setVariantLocationMock.mock.calls[0] as [
          string,
          string,
          string,
          { qty: number; price: number; availablePickup?: boolean; featured?: boolean },
          { reason?: string; source?: string; actor?: string },
        ];

      expect(slug).toBe('product-a');
      expect(variantId).toBe('default');
      expect(locId).toBe('oak-ridge');
      expect(patch.qty).toBeGreaterThanOrEqual(1);
      expect(patch.price).toBe(0);
      expect(meta.reason).toBe('toggle-stock');
      expect(meta.source).toBe('admin');
      expect(meta.actor).toBe('owner@rushnrelax.com');
    });
  });

  describe('given a manual quantity update', () => {
    it('writes the exact qty with manual-count reason and preserves existing price', async () => {
      stubAuthorisedActor();
      stubProduct({ qty: 4, price: 1500 });

      await updateInventoryItem('oak-ridge', 'product-a', { quantity: 12 });

      const [, , , patch, meta] = setVariantLocationMock.mock.calls[0] as [
        string,
        string,
        string,
        { qty: number; price: number },
        { reason?: string },
      ];
      expect(patch.qty).toBe(12);
      expect(patch.price).toBe(1500);
      expect(meta.reason).toBe('manual-count');
    });
  });

  describe('given availablePickup toggled', () => {
    it('writes patch.availablePickup with toggle-pickup reason', async () => {
      stubAuthorisedActor();
      stubProduct({ qty: 5, price: 1000 });

      await updateInventoryItem('oak-ridge', 'product-a', {
        availablePickup: true,
      });

      const [, , , patch, meta] = setVariantLocationMock.mock.calls[0] as [
        string,
        string,
        string,
        { availablePickup?: boolean },
        { reason?: string },
      ];
      expect(patch.availablePickup).toBe(true);
      expect(meta.reason).toBe('toggle-pickup');
    });
  });

  describe('given featured=true requested while resulting qty is 0', () => {
    it('rejects with the invariant-violation error', async () => {
      stubAuthorisedActor();
      stubProduct({ qty: 0, price: 0 });

      const result = await updateInventoryItem('oak-ridge', 'product-a', {
        featured: true,
      });

      expect(result).toEqual({
        ok: false,
        error: 'Cannot feature an item that is not in stock.',
      });
      expect(setVariantLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given featured=true while in stock', () => {
    it('writes featured=true with toggle-featured reason', async () => {
      stubAuthorisedActor();
      stubProduct({ qty: 5, price: 1000 });

      await updateInventoryItem('oak-ridge', 'product-a', { featured: true });

      const [, , , patch, meta] = setVariantLocationMock.mock.calls[0] as [
        string,
        string,
        string,
        { featured?: boolean },
        { reason?: string },
      ];
      expect(patch.featured).toBe(true);
      expect(meta.reason).toBe('toggle-featured');
    });
  });

  describe('given inStock toggled off', () => {
    it('writes qty=0 and forces availablePickup/featured to false', async () => {
      stubAuthorisedActor();
      stubProduct({ qty: 5, price: 1000, availablePickup: true, featured: true });

      await updateInventoryItem('oak-ridge', 'product-a', { inStock: false });

      const [, , , patch] = setVariantLocationMock.mock.calls[0] as [
        string,
        string,
        string,
        { qty: number; availablePickup?: boolean; featured?: boolean },
      ];
      expect(patch.qty).toBe(0);
      expect(patch.availablePickup).toBe(false);
      expect(patch.featured).toBe(false);
    });
  });

  describe('given setVariantLocation throws', () => {
    it('returns ok:false without revalidating paths', async () => {
      stubAuthorisedActor();
      stubProductWithoutVariantSpecs();
      setVariantLocationMock.mockRejectedValue(
        new Error("Variant 'default' not found on product 'product-a'")
      );

      const result = await updateInventoryItem('oak-ridge', 'product-a', {
        inStock: true,
      });

      expect(result.ok).toBe(false);
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  describe('given a successful update', () => {
    it('revalidates the expected paths', async () => {
      stubAuthorisedActor();
      stubProductWithoutVariantSpecs();

      await updateInventoryItem('oak-ridge', 'product-a', { inStock: false });

      expect(revalidatePathMock).toHaveBeenCalledWith(
        '/admin/inventory/oak-ridge'
      );
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/inventory');
      expect(revalidatePathMock).toHaveBeenCalledWith('/');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products');
    });
  });
});

import { updateVariantPricing } from '@/app/(admin)/admin/inventory/[locationId]/actions';

describe('updateVariantPricing server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setInventoryItemMock.mockResolvedValue(undefined);
  });

  describe('given an unauthenticated caller', () => {
    it('does not call setInventoryItem and propagates the redirect', async () => {
      stubUnauthorised();

      await expect(
        updateVariantPricing('oak-ridge', 'flower', { '1g': { price: 1000 } })
      ).rejects.toThrow('NEXT_REDIRECT:/admin/login');

      expect(setInventoryItemMock).not.toHaveBeenCalled();
    });
  });

  describe('given an authorised owner updating variant pricing', () => {
    it('calls setInventoryItem with the variantPricing payload and price-update reason', async () => {
      stubAuthorisedActor();
      const pricing = { '1g': { price: 1200 }, '7g': { price: 5500 } };

      await updateVariantPricing('oak-ridge', 'flower', pricing);

      expect(setInventoryItemMock).toHaveBeenCalledOnce();
      const [locId, prodId, patch, adjustment] = setInventoryItemMock.mock
        .calls[0] as [
        string,
        string,
        Record<string, unknown>,
        Record<string, unknown>,
      ];

      expect(locId).toBe('oak-ridge');
      expect(prodId).toBe('flower');
      expect(patch.variantPricing).toEqual(pricing);
      expect(patch.updatedBy).toBe('owner@rushnrelax.com');
      expect(adjustment.reason).toBe('price-update');
      expect(adjustment.source).toBe('admin-ui');
      expect(adjustment.updatedBy).toBe('owner@rushnrelax.com');
    });
  });
});
