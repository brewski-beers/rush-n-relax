import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Category } from '@/types';
import { categoryQueries } from './categoryQueries';
import { categoryRepository } from '@/repositories/CategoryRepository';

vi.mock('@/repositories/CategoryRepository', () => ({
  categoryRepository: {
    getAll: vi.fn(),
    getActive: vi.fn(),
    getBySlug: vi.fn(),
    getById: vi.fn(),
  },
}));

const mockCategory: Category = {
  id: 'cat-1',
  name: 'Flower',
  slug: 'flower',
  description: 'Premium flower',
  imageUrl: 'https://example.com/flower.jpg',
  order: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('categoryQueries', () => {
  it('all uses correct query key', () => {
    expect(categoryQueries.all().queryKey).toEqual(['categories']);
  });

  it('active uses correct query key', () => {
    expect(categoryQueries.active().queryKey).toEqual(['categories', 'active']);
  });

  it('bySlug throws when category not found', async () => {
    vi.mocked(categoryRepository.getBySlug).mockResolvedValueOnce(null);
    const query = categoryQueries.bySlug('missing');
    await expect(
      query.queryFn?.({ queryKey: query.queryKey } as unknown as any)
    ).rejects.toThrow('Category not found');
  });

  it('byId resolves category data', async () => {
    vi.mocked(categoryRepository.getById).mockResolvedValueOnce(mockCategory);

    const query = categoryQueries.byId('cat-1');
    const result = await query.queryFn?.({ queryKey: query.queryKey } as unknown as any);
    expect(result).toEqual(mockCategory);
  });
});
