import { Suspense } from 'react';
import { CategoryFilter } from '@/components/CategoryFilter';
import { ProductGridSkeleton } from '@/components/ProductGridSkeleton';
import { buildMetadata } from '@/lib/seo/metadata.factory';
import { listActiveCategories } from '@/lib/repositories';
import { ProductsGrid } from './ProductsGrid';
import '@/styles/products.css';

export const dynamic = 'force-dynamic';

export const metadata = buildMetadata('/products', {
  title:
    'Premium Cannabis Products — Flower, Concentrates, Edibles, Vapes & Drinks | Rush N Relax',
  description:
    "Browse Rush N Relax's curated lineup of premium cannabis flower, concentrates, gourmet edibles, sleek vapes, and THCa-infused drinks. Available at all three East Tennessee locations.",
  path: '/products',
});

interface Props {
  searchParams: Promise<{ category?: string; page?: string }>;
}

export default async function ProductsPage({ searchParams }: Props) {
  const { category: rawCategory, page: rawPage } = await searchParams;

  const categories = await listActiveCategories();
  const validCategory = categories.some(c => c.slug === rawCategory)
    ? rawCategory
    : null;

  return (
    <main className="products-page">
      <section
        id="products-hero"
        className="products-hero asymmetry-section-stable page-hero-shell"
      >
        <div className="container">
          <h1>Our Products</h1>
          <p className="lead">
            Five categories, one standard — every item on our shelves is
            hand-selected, lab-tested, and stocked because we'd choose it
            ourselves.
          </p>
        </div>
      </section>

      <section
        id="products-grid"
        className="products-grid-section asymmetry-section-anchor"
      >
        <div className="container">
          <Suspense fallback={<div className="category-filter-placeholder" />}>
            <CategoryFilter
              categories={categories}
              currentCategory={validCategory ?? null}
            />
          </Suspense>

          <Suspense
            key={`${validCategory ?? 'all'}-${rawPage ?? '1'}`}
            fallback={<ProductGridSkeleton />}
          >
            <ProductsGrid category={validCategory ?? null} rawPage={rawPage} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
