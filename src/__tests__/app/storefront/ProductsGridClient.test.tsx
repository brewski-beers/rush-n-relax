import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductsGridClient } from '@/app/(storefront)/products/ProductsGridClient';
import type { ProductsPageItem } from '@/app/api/products/route';

vi.mock('@/components/ProductImage', () => ({
  ProductImage: ({ alt }: { alt: string }) => (
    <div data-testid="product-image">{alt}</div>
  ),
}));

function makeItem(overrides: Partial<ProductsPageItem>): ProductsPageItem {
  return {
    id: overrides.slug ?? 'id-x',
    slug: 'slug-x',
    name: 'Name X',
    category: 'flower',
    image: null,
    featured: false,
    ...overrides,
  } as ProductsPageItem;
}

describe('ProductsGridClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Given initialNextCursor is null', () => {
    it('renders initial items and hides Load More', () => {
      render(
        <ProductsGridClient
          initialItems={[makeItem({ slug: 'a', name: 'Alpha' })]}
          initialNextCursor={null}
          category={null}
        />
      );

      expect(
        screen.getByRole('heading', { name: 'Alpha' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /load more products/i })
      ).toBeNull();
    });
  });

  describe('Given initialNextCursor is present', () => {
    it('fetches next page with cursor + category and appends items', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [makeItem({ slug: 'b', name: 'Beta' })],
          nextCursor: null,
        }),
      }));
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <ProductsGridClient
          initialItems={[makeItem({ slug: 'a', name: 'Alpha' })]}
          initialNextCursor="cursor-1"
          category="flower"
        />
      );

      const button = screen.getByRole('button', {
        name: /load more products/i,
      });
      await act(async () => {
        await user.click(button);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledWith = String(
        (fetchMock.mock.calls as unknown as [string][])[0]?.[0]
      );
      expect(calledWith).toContain('cursor=cursor-1');
      expect(calledWith).toContain('category=flower');
      expect(calledWith).toContain('limit=25');

      expect(
        screen.getByRole('heading', { name: 'Alpha' })
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Beta' })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /load more products/i })
      ).toBeNull();
    });

    it('omits category param when category is null', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ items: [], nextCursor: null }),
      }));
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <ProductsGridClient
          initialItems={[makeItem({ slug: 'a', name: 'Alpha' })]}
          initialNextCursor="cursor-1"
          category={null}
        />
      );

      await act(async () => {
        await user.click(
          screen.getByRole('button', { name: /load more products/i })
        );
      });

      const calledWith = String(
        (fetchMock.mock.calls as unknown as [string][])[0]?.[0]
      );
      expect(calledWith).not.toContain('category=');
    });
  });
});
