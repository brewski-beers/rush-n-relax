import type { Category } from '@/types';

export const SEED_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Flower',
    slug: 'flower',
    description: 'Premium cannabis flower strains',
    imageUrl:
      'https://images.unsplash.com/photo-1597733336794-12d05021d510?w=800&h=600&fit=crop',
    order: 1,
    isActive: true,
    seoTitle: 'Cannabis Flower | Rush N Relax',
    seoDescription:
      'Browse our selection of premium cannabis flower strains.',
  },
  {
    name: 'Edibles',
    slug: 'edibles',
    description: 'Delicious cannabis-infused treats',
    imageUrl:
      'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=800&h=600&fit=crop',
    order: 2,
    isActive: true,
    seoTitle: 'Cannabis Edibles | Rush N Relax',
    seoDescription: 'Delicious cannabis-infused edibles and treats.',
  },
  {
    name: 'Vapes',
    slug: 'vapes',
    description: 'Portable vaporizers and cartridges',
    imageUrl:
      'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&h=600&fit=crop',
    order: 3,
    isActive: true,
    seoTitle: 'Vaporizers & Cartridges | Rush N Relax',
    seoDescription: 'High-quality vaporizers and cannabis cartridges.',
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Everything you need for a great session',
    imageUrl:
      'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=800&h=600&fit=crop',
    order: 4,
    isActive: true,
    seoTitle: 'Cannabis Accessories | Rush N Relax',
    seoDescription: 'Grinders, papers, and all your cannabis accessories.',
  },
];
