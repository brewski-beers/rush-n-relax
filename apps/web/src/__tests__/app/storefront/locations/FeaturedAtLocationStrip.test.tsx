import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { ProductSummary } from '@/types';

const listFeaturedProductsAt = vi.fn();

vi.mock('@/lib/repositories', () => ({
  listFeaturedProductsAt: (...args: unknown[]) =>
    listFeaturedProductsAt(...args) as unknown,
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

describe('FeaturedAtLocationStrip (#238) — post-#312 product-driven', () => {
  beforeEach(() => {
    listFeaturedProductsAt.mockReset();
  });

  it('given location L has 3 featured in-stock products, /locations/L renders the strip with those 3', async () => {
    listFeaturedProductsAt.mockResolvedValueOnce([
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
    listFeaturedProductsAt.mockResolvedValueOnce([]);

    const ui = await FeaturedAtLocationStrip({ locationId: 'maryville' });
    expect(ui).toBeNull();
  });

  it('caps the visible products at 6', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    listFeaturedProductsAt.mockResolvedValueOnce(ids.map(prod));

    const ui = await FeaturedAtLocationStrip({ locationId: 'seymour' });
    const { queryByText } = render(<>{ui}</>);
    expect(queryByText('A')).not.toBeNull();
    expect(queryByText('F')).not.toBeNull();
    expect(queryByText('G')).toBeNull();
    expect(queryByText('H')).toBeNull();
  });
});
