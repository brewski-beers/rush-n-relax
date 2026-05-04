import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { ProductSummary, InventoryItem } from '@/types';

const listFeaturedAtLocation = vi.fn();
const listProductsByIds = vi.fn();

vi.mock('@/lib/repositories', () => ({
  listFeaturedAtLocation: (...args: unknown[]) =>
    listFeaturedAtLocation(...args) as unknown,
  listProductsByIds: (...args: unknown[]) =>
    listProductsByIds(...args) as unknown,
}));

vi.mock('@/lib/storage/url-cache', () => ({
  getStorageUrl: (p: string) => p,
}));

vi.mock('@/components/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/CardGrid', () => ({
  CardGrid: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ProductImage', () => ({
  ProductImage: () => <div />,
}));

import { FeaturedAtLocationStrip } from '@/app/(storefront)/locations/[slug]/FeaturedAtLocationStrip';

function inv(productId: string): InventoryItem {
  return {
    productId,
    locationId: 'oak-ridge',
    inStock: true,
    availablePickup: true,
    featured: true,
    quantity: 5,
  } as unknown as InventoryItem;
}

function prod(id: string): ProductSummary {
  return {
    id,
    slug: id,
    name: id.toUpperCase(),
    category: 'flower',
    image: null,
    status: 'active',
    availableAt: ['oak-ridge'],
  } as unknown as ProductSummary;
}

describe('FeaturedAtLocationStrip (#238)', () => {
  beforeEach(() => {
    listFeaturedAtLocation.mockReset();
    listProductsByIds.mockReset();
  });

  it('given location L has 3 featured in-stock products, /locations/L renders the strip with those 3', async () => {
    listFeaturedAtLocation.mockResolvedValueOnce([
      inv('p1'),
      inv('p2'),
      inv('p3'),
    ]);
    listProductsByIds.mockResolvedValueOnce([
      prod('p1'),
      prod('p2'),
      prod('p3'),
    ]);

    const ui = await FeaturedAtLocationStrip({ locationId: 'oak-ridge' });
    const { getByTestId, getByText } = render(<>{ui}</>);

    const strip = getByTestId('location-featured-strip');
    expect(strip).toBeDefined();
    expect(getByText('P1')).toBeDefined();
    expect(getByText('P2')).toBeDefined();
    expect(getByText('P3')).toBeDefined();
  });

  it('given location L has 0 featured in-stock products, /locations/L does NOT render the strip', async () => {
    listFeaturedAtLocation.mockResolvedValueOnce([]);

    const ui = await FeaturedAtLocationStrip({ locationId: 'maryville' });
    expect(ui).toBeNull();
  });

  it('caps the visible products at 6', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    listFeaturedAtLocation.mockResolvedValueOnce(ids.map(inv));
    listProductsByIds.mockResolvedValueOnce(ids.map(prod));

    const ui = await FeaturedAtLocationStrip({ locationId: 'seymour' });
    const { queryByText } = render(<>{ui}</>);
    expect(queryByText('A')).not.toBeNull();
    expect(queryByText('F')).not.toBeNull();
    expect(queryByText('G')).toBeNull();
    expect(queryByText('H')).toBeNull();
  });
});
