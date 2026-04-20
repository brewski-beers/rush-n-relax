'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useOptimistic } from 'react';
import type { ProductCategorySummary } from '@/types';
import './CategoryFilter.css';

interface CategoryFilterProps {
  categories: ProductCategorySummary[];
  currentCategory: string | null;
}

export function CategoryFilter({
  categories,
  currentCategory,
}: CategoryFilterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticCategory, setOptimisticCategory] =
    useOptimistic(currentCategory);

  function handleSelect(slug: string | null) {
    const url = slug ? `/products?category=${slug}` : '/products';
    setOptimisticCategory(slug);
    startTransition(() => {
      router.push(url);
    });
  }

  return (
    <nav
      className={`category-filter${isPending ? ' category-filter--pending' : ''}`}
      aria-label="Filter by category"
    >
      <button
        type="button"
        onClick={() => handleSelect(null)}
        className={`category-filter__pill${optimisticCategory === null ? ' category-filter__pill--active' : ''}`}
        aria-pressed={optimisticCategory === null}
      >
        All
      </button>
      {categories.map(cat => (
        <button
          key={cat.slug}
          type="button"
          onClick={() => handleSelect(cat.slug)}
          className={`category-filter__pill${optimisticCategory === cat.slug ? ' category-filter__pill--active' : ''}`}
          aria-pressed={optimisticCategory === cat.slug}
        >
          {cat.label}
        </button>
      ))}
    </nav>
  );
}
