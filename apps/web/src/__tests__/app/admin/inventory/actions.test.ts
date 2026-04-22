import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  setInventoryItemMock,
  getInventoryItemMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  setInventoryItemMock: vi.fn().mockResolvedValue(undefined),
  getInventoryItemMock: vi.fn().mockResolvedValue(null),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  setInventoryItem: setInventoryItemMock,
  getInventoryItem: getInventoryItemMock,
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
  // next/navigation redirect throws; replicate same pattern for admin-auth
  requireRoleMock.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT:/admin/login');
  });
}

function stubSavedItem(overrides: {
  availableOnline?: boolean;
  availablePickup?: boolean;
  inStock?: boolean;
  quantity?: number;
}) {
  getInventoryItemMock.mockResolvedValue({
    productId: 'p',
    locationId: 'hub',
    inStock: overrides.inStock ?? false,
    availableOnline: overrides.availableOnline ?? false,
    availablePickup: overrides.availablePickup ?? false,
    featured: false,
    quantity: overrides.quantity ?? 0,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('updateInventoryItem server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setInventoryItemMock.mockResolvedValue(undefined);
    getInventoryItemMock.mockResolvedValue(null);
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect thrown by requireRole', async () => {
      stubUnauthorised();

      await expect(
        updateInventoryItem('hub', 'product-a', { inStock: true })
      ).rejects.toThrow('NEXT_REDIRECT:/admin/login');

      expect(setInventoryItemMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  describe('given a valid owner toggling inStock', () => {
    it('calls setInventoryItem with toggle-stock reason and the actor email', async () => {
      stubAuthorisedActor();

      await updateInventoryItem('hub', 'product-a', { inStock: true });

      expect(setInventoryItemMock).toHaveBeenCalledOnce();
      const [locId, prodId, patch, adjustment] = setInventoryItemMock.mock
        .calls[0] as [
        string,
        string,
        Record<string, unknown>,
        Record<string, unknown>,
      ];

      expect(locId).toBe('hub');
      expect(prodId).toBe('product-a');
      expect(patch.inStock).toBe(true);
      expect(adjustment.reason).toBe('toggle-stock');
      expect(adjustment.updatedBy).toBe('owner@rushnrelax.com');
      expect(adjustment.source).toBe('admin-ui');
    });
  });

  describe('given a valid owner providing a manual quantity count', () => {
    it('calls setInventoryItem with manual-count reason', async () => {
      stubAuthorisedActor();

      await updateInventoryItem('oak-ridge', 'product-b', { quantity: 15 });

      const [, , , adjustment] = setInventoryItemMock.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(adjustment.reason).toBe('manual-count');
    });
  });

  describe('given a valid owner toggling featured', () => {
    it('calls setInventoryItem with toggle-featured reason', async () => {
      stubAuthorisedActor();
      stubSavedItem({ inStock: true, availablePickup: true, quantity: 5 });

      await updateInventoryItem('hub', 'product-c', { featured: true });

      const [, , , adjustment] = setInventoryItemMock.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(adjustment.reason).toBe('toggle-featured');
    });
  });

  describe('given a valid owner toggling availablePickup', () => {
    it('calls setInventoryItem with toggle-pickup reason', async () => {
      stubAuthorisedActor();

      await updateInventoryItem('oak-ridge', 'product-d', {
        availablePickup: true,
      });

      const [, , , adjustment] = setInventoryItemMock.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(adjustment.reason).toBe('toggle-pickup');
    });
  });

  describe('given a successful update', () => {
    it('revalidates the expected paths', async () => {
      stubAuthorisedActor();

      await updateInventoryItem('hub', 'product-f', { inStock: false });

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/inventory/hub');
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/inventory');
      expect(revalidatePathMock).toHaveBeenCalledWith('/');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products');
    });
  });

  describe('given setInventoryItem throws (e.g. compliance-hold)', () => {
    it('propagates the error without revalidating paths', async () => {
      stubAuthorisedActor();
      setInventoryItemMock.mockRejectedValue(
        new Error(
          "Cannot mark 'product-hold' available for purchase: product is on compliance-hold"
        )
      );

      await expect(
        updateInventoryItem('hub', 'product-hold', { inStock: true })
      ).rejects.toThrow('compliance-hold');

      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  // Cascade-blocked signal (issue #179) was removed in issue #233 —
  // the inStock master-switch model replaces cascade behavior.

  describe('given featured=true is requested while the item is not inStock', () => {
    it('returns ok:false with an invariant-violation error', async () => {
      stubAuthorisedActor();
      stubSavedItem({
        availablePickup: false,
        inStock: false,
        quantity: 0,
      });

      const result = await updateInventoryItem('hub', 'product-k', {
        featured: true,
      });

      expect(result).toEqual({
        ok: false,
        error: 'Cannot feature an item that is not in stock.',
      });
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
        updateVariantPricing('hub', 'flower', { '1g': { price: 1000 } })
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

  describe('given a successful variant pricing update', () => {
    it('revalidates the location inventory path, /admin/inventory, and /products', async () => {
      stubAuthorisedActor();

      await updateVariantPricing('seymour', 'concentrates', {
        '1g': { price: 4500 },
      });

      expect(revalidatePathMock).toHaveBeenCalledWith(
        '/admin/inventory/seymour'
      );
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/inventory');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products');
      // Should NOT revalidate '/' (only updateInventoryItem does that)
      expect(revalidatePathMock).not.toHaveBeenCalledWith('/');
    });
  });
});
