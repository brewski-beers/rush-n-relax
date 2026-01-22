import { useParams, Navigate } from 'react-router-dom';
import { ProductGrid } from '@/components/ProductGrid';
import useProductsByCategory from '@/hooks/useProductsByCategory';
import type { ProductCategory } from '@/types';

const VALID_CATEGORIES: ProductCategory[] = ['flower', 'edibles', 'vapes', 'accessories'];

const CATEGORY_NAMES: Record<ProductCategory, string> = {
  flower: 'Flower',
  edibles: 'Edibles',
  vapes: 'Vapes',
  accessories: 'Accessories'
};

/**
 * CategoryProducts Page
 * 
 * Displays all products in a specific category.
 * Uses Suspense for loading and ErrorBoundary for errors (provided by PageLayout).
 * 
 * No manual loading/error state management - follows "headless UI" principles.
 */
export default function CategoryProducts() {
  const { category } = useParams<{ category: string }>();

  // Validate category
  if (!category || !VALID_CATEGORIES.includes(category as ProductCategory)) {
    return <Navigate to="/" replace />;
  }

  const validCategory = category as ProductCategory;
  const products = useProductsByCategory(validCategory);

  const displayProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: p.imageUrl || '',
    category: p.category
  }));

  return (
    <div className="category-page">
      <div className="category-header">
        <nav className="breadcrumb">
          <a href="/">Home</a>
          <span> / </span>
          <span>{CATEGORY_NAMES[validCategory]}</span>
        </nav>
        <h1>{CATEGORY_NAMES[validCategory]}</h1>
      </div>

      {products.length === 0 ? (
        <p className="empty-state">No products available in this category.</p>
      ) : (
        <ProductGrid products={displayProducts} />
      )}
    </div>
  );
}
