import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  runTransactionMock,
  txGetMock,
  txSetMock,
  txCreateMock,
  productsCollectionMock,
} = vi.hoisted(() => {
  const txGetMock = vi.fn();
  const txSetMock = vi.fn();
  const txCreateMock = vi.fn();

  const runTransactionMock = vi.fn(
    async (
      fn: (tx: {
        get: typeof txGetMock;
        set: typeof txSetMock;
        create: typeof txCreateMock;
      }) => Promise<unknown>
    ) => fn({ get: txGetMock, set: txSetMock, create: txCreateMock })
  );

  const adjustmentsDoc = vi.fn(() => ({
    id: `adj-${Math.random().toString(36).slice(2)}`,
  }));
  const adjustmentsCol = vi.fn(() => ({ doc: adjustmentsDoc }));

  const productDoc = vi.fn((id: string) => ({
    id,
    _path: `products/${id}`,
    collection: adjustmentsCol,
  }));

  const productsCollectionMock = vi.fn(() => ({ doc: productDoc }));

  return {
    runTransactionMock,
    txGetMock,
    txSetMock,
    txCreateMock,
    productsCollectionMock,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: () => ({
    collection: productsCollectionMock,
    runTransaction: runTransactionMock,
  }),
  toDate: (v: Date | string | undefined) => (v ? new Date(v) : new Date(0)),
  ONLINE_LOCATION_ID: 'online',
}));

import {
  holdStock,
  releaseStock,
  commitStock,
  InsufficientStockError,
} from '@/lib/repositories/product.repository';

function productSnap(
  slug: string,
  variants: Record<
    string,
    {
      label: string;
      locations: Record<string, Record<string, unknown>>;
    }
  >
) {
  return {
    id: slug,
    exists: true,
    data: () => ({
      slug,
      name: `Product ${slug}`,
      category: 'flower',
      details: '',
      status: 'active',
      availableAt: [],
      variants,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── holdStock ──────────────────────────────────────────────────────────────

describe('holdStock', () => {
  it('is a no-op when called with an empty list', async () => {
    await holdStock([]);
    expect(runTransactionMock).not.toHaveBeenCalled();
  });

  it('increments reserved on the targeted variant/location', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: { online: { qty: 5, reserved: 1, price: 1500 } },
        },
      })
    );

    await holdStock([
      {
        productId: 'blue-dream',
        variantId: 'default',
        locationId: 'online',
        qty: 2,
      },
    ]);

    expect(runTransactionMock).toHaveBeenCalledOnce();
    const [, payload] = txSetMock.mock.calls[0];
    const p = payload as Record<string, unknown>;
    const specs = p.variants as Record<
      string,
      { locations: Record<string, { reserved: number; qty: number }> }
    >;
    expect(specs.default.locations.online.reserved).toBe(3);
    expect(specs.default.locations.online.qty).toBe(5); // qty unchanged
  });

  it('treats missing reserved as 0 when computing available stock', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: { online: { qty: 3, price: 1500 } }, // no reserved field
        },
      })
    );

    await holdStock([
      {
        productId: 'blue-dream',
        variantId: 'default',
        locationId: 'online',
        qty: 3,
      },
    ]);

    const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
    const specs = payload.variants as Record<
      string,
      { locations: Record<string, { reserved: number }> }
    >;
    expect(specs.default.locations.online.reserved).toBe(3);
  });

  it('throws InsufficientStockError when available < requested and writes nothing', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: { online: { qty: 2, reserved: 1, price: 1500 } },
        },
      })
    );

    await expect(
      holdStock([
        {
          productId: 'blue-dream',
          variantId: 'default',
          locationId: 'online',
          qty: 2,
        },
      ])
    ).rejects.toBeInstanceOf(InsufficientStockError);
    expect(txSetMock).not.toHaveBeenCalled();
    expect(txCreateMock).not.toHaveBeenCalled();
  });

  it('drops location from inStockAt when remaining available reaches zero', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: { online: { qty: 2, reserved: 0, price: 1500 } },
        },
      })
    );

    await holdStock([
      {
        productId: 'blue-dream',
        variantId: 'default',
        locationId: 'online',
        qty: 2,
      },
    ]);

    const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.inStockAt).toEqual([]);
  });

  it('writes one audit log row per touched (variant, location)', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: { online: { qty: 5, reserved: 0, price: 1500 } },
        },
      })
    );

    await holdStock(
      [
        {
          productId: 'blue-dream',
          variantId: 'default',
          locationId: 'online',
          qty: 1,
        },
      ],
      { source: 'order', actor: 'webhook' }
    );

    expect(txCreateMock).toHaveBeenCalledOnce();
    const audit = txCreateMock.mock.calls[0][1] as Record<string, unknown>;
    expect(audit.slug).toBe('blue-dream');
    expect(audit.variantId).toBe('default');
    expect(audit.actor).toBe('webhook');
    expect(audit.delta).toBe(0); // qty unchanged on hold
    expect(audit.reason).toBe('stock-hold');
  });

  it('throws when a referenced variant does not exist', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: { label: 'Default', locations: {} },
      })
    );
    await expect(
      holdStock([
        {
          productId: 'blue-dream',
          variantId: 'eighth',
          locationId: 'online',
          qty: 1,
        },
      ])
    ).rejects.toThrow(/Variant 'eighth' not found/);
  });
});

// ── releaseStock ───────────────────────────────────────────────────────────

describe('releaseStock', () => {
  it('decrements reserved by the requested qty', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: { online: { qty: 5, reserved: 3, price: 1500 } },
        },
      })
    );

    await releaseStock([
      {
        productId: 'blue-dream',
        variantId: 'default',
        locationId: 'online',
        qty: 2,
      },
    ]);

    const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
    const specs = payload.variants as Record<
      string,
      { locations: Record<string, { reserved: number; qty: number }> }
    >;
    expect(specs.default.locations.online.reserved).toBe(1);
    expect(specs.default.locations.online.qty).toBe(5);
  });

  it('clamps reserved at 0 when release exceeds existing reservation (no-op safe)', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: { online: { qty: 5, reserved: 1, price: 1500 } },
        },
      })
    );

    await releaseStock([
      {
        productId: 'blue-dream',
        variantId: 'default',
        locationId: 'online',
        qty: 5,
      },
    ]);

    const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
    const specs = payload.variants as Record<
      string,
      { locations: Record<string, { reserved: number }> }
    >;
    expect(specs.default.locations.online.reserved).toBe(0);
  });

  it('returns location to inStockAt when reservations are released', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: { online: { qty: 2, reserved: 2, price: 1500 } },
        },
      })
    );

    await releaseStock([
      {
        productId: 'blue-dream',
        variantId: 'default',
        locationId: 'online',
        qty: 2,
      },
    ]);

    const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.inStockAt).toEqual(['online']);
  });
});

// ── commitStock ────────────────────────────────────────────────────────────

describe('commitStock', () => {
  it('decrements both qty and reserved atomically', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: { online: { qty: 5, reserved: 2, price: 1500 } },
        },
      })
    );

    await commitStock([
      {
        productId: 'blue-dream',
        variantId: 'default',
        locationId: 'online',
        qty: 2,
      },
    ]);

    const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
    const specs = payload.variants as Record<
      string,
      { locations: Record<string, { qty: number; reserved: number }> }
    >;
    expect(specs.default.locations.online.qty).toBe(3);
    expect(specs.default.locations.online.reserved).toBe(0);
  });

  it('clears availablePickup and featured when qty hits 0 and recomputes inStockAt', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: {
            online: {
              qty: 1,
              reserved: 1,
              price: 1500,
              availablePickup: true,
              featured: true,
            },
          },
        },
      })
    );

    await commitStock([
      {
        productId: 'blue-dream',
        variantId: 'default',
        locationId: 'online',
        qty: 1,
      },
    ]);

    const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
    const specs = payload.variants as Record<
      string,
      {
        locations: Record<
          string,
          { qty: number; availablePickup?: boolean; featured?: boolean }
        >;
      }
    >;
    expect(specs.default.locations.online.qty).toBe(0);
    expect(specs.default.locations.online.availablePickup).toBe(false);
    expect(specs.default.locations.online.featured).toBe(false);
    expect(payload.inStockAt).toEqual([]);
    expect(payload.pickupAt).toEqual([]);
    expect(payload.featuredAt).toEqual([]);
  });

  it('throws InsufficientStockError when qty < requested', async () => {
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: { online: { qty: 1, reserved: 0, price: 1500 } },
        },
      })
    );

    await expect(
      commitStock([
        {
          productId: 'blue-dream',
          variantId: 'default',
          locationId: 'online',
          qty: 2,
        },
      ])
    ).rejects.toBeInstanceOf(InsufficientStockError);
    expect(txSetMock).not.toHaveBeenCalled();
  });
});

// ── recomputeIndexes via reserved (read-side semantic) ─────────────────────

describe('available-stock semantics', () => {
  it('recomputeIndexes excludes a location whose entire qty is reserved', async () => {
    // Hold 1 unit of a location with qty=1 — should drop from inStockAt.
    txGetMock.mockResolvedValueOnce(
      productSnap('blue-dream', {
        default: {
          label: 'Default',
          locations: { online: { qty: 1, reserved: 0, price: 1500 } },
        },
      })
    );

    await holdStock([
      {
        productId: 'blue-dream',
        variantId: 'default',
        locationId: 'online',
        qty: 1,
      },
    ]);

    const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.inStockAt).toEqual([]);
  });
});
