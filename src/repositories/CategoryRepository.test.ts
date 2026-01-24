import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirestoreCategoryRepository } from './CategoryRepository';
import type { Category } from '@/types';

vi.mock('@/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore');

describe('FirestoreCategoryRepository', () => {
  let repository: FirestoreCategoryRepository;

  beforeEach(() => {
    repository = new FirestoreCategoryRepository();
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('returns all categories ordered by order field', async () => {
      const { getDocs } = await import('firebase/firestore');
      const mockCategories: Partial<Category>[] = [
        { id: 'flower', name: 'Flower', slug: 'flower', order: 1, isActive: true },
        { id: 'edibles', name: 'Edibles', slug: 'edibles', order: 2, isActive: true },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockCategories.map(cat => ({
          id: cat.id,
          data: () => cat,
        })),
      } as any);

      const categories = await repository.getAll();

      expect(categories).toHaveLength(2);
      expect(categories[0].slug).toBe('flower');
    });

    it('returns empty array when no categories', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

      const categories = await repository.getAll();

      expect(categories).toEqual([]);
    });
  });

  describe('getActive', () => {
    it('returns only active categories', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({
        docs: [{
          id: 'flower',
          data: () => ({ name: 'Flower', isActive: true }),
        }],
      } as any);

      const categories = await repository.getActive();

      expect(categories).toHaveLength(1);
    });
  });

  describe('getBySlug', () => {
    it('returns category when found', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [{
          id: 'flower',
          data: () => ({ name: 'Flower', slug: 'flower' }),
        }],
      } as any);

      const category = await repository.getBySlug('flower');

      expect(category).toBeDefined();
      expect(category?.slug).toBe('flower');
    });

    it('returns null when not found', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as any);

      const category = await repository.getBySlug('nonexistent');

      expect(category).toBeNull();
    });
  });

  describe('getById', () => {
    it('returns category when found', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [{
          id: 'flower',
          data: () => ({ name: 'Flower', id: 'flower' }),
        }],
      } as any);

      const category = await repository.getById('flower');

      expect(category).toBeDefined();
    });
  });
});
