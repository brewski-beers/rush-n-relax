'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export interface CategoryOption {
  slug: string;
  name: string;
}

interface Props {
  categories: CategoryOption[];
  initial: {
    category?: string;
    q?: string;
  };
}

/**
 * Admin /products filter bar. Submits via the URL — the parent Server
 * Component re-renders against the new searchParams. Applying or resetting
 * clears pagination cursors so the user lands on page 1 of the new view.
 */
export function ProductsFilters({ categories, initial }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [category, setCategory] = useState(initial.category ?? '');
  const [q, setQ] = useState(initial.q ?? '');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (q.trim()) params.set('q', q.trim());
    const qs = params.toString();
    router.push(qs ? `/admin/products?${qs}` : '/admin/products');
  }

  function handleReset() {
    setCategory('');
    setQ('');
    router.push('/admin/products');
  }

  const _hasParams = searchParams.toString().length > 0;
  void _hasParams;

  return (
    <form
      className="admin-filters"
      onSubmit={handleSubmit}
      aria-label="Product filters"
    >
      <label>
        <span>Category</span>
        <select
          name="category"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">All</option>
          {categories.map(c => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Search</span>
        <input
          type="search"
          name="q"
          placeholder="Product name…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </label>
      <div className="admin-filters-actions">
        <button type="submit" className="admin-btn-primary">
          Apply
        </button>
        <button
          type="button"
          className="admin-btn-secondary"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
