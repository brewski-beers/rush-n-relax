import { useParams, Navigate } from 'react-router-dom';
import { ProductGrid } from '@/components/ProductGrid';
import { NoProductsEmptyState } from '@/components/EmptyState';
import useProductsByCategory from '@/hooks/useProductsByCategory';
import { useCategoryBySlug } from '@/hooks/useCategories';

/**
 * CategoryProducts Page
 * 
 * Displays all products in a specific category.
 * Uses Suspense for loading and ErrorBoundary for errors (provided by PageLayout).
 * 
 * No manual loading/error state management - follows "headless UI" principles.
 */
export default function CategoryProducts() {
  const { category: categorySlug } = useParams<{ category: string }>();

  // Validate category slug
  if (!categorySlug) {
    return <Navigate to="/" replace />;
  }

  // Fetch category (will throw if not found, caught by ErrorBoundary)
  const category = useCategoryBySlug(categorySlug);
  const products = useProductsByCategory(category.id);

  const displayProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: p.imageUrl || '',
    categoryId: p.categoryId
  }));

  return (
    <div className="category-page">
      <div className="category-header">
        <nav className="breadcrumb">
          <a href="/">Home</a>
          <span> / </span>
          <span>{category.name}</span>
        </nav>
        <h1>{category.name}</h1>
        {category.description && <p className="category-description">{category.description}</p>}
      </div>

      {products.length === 0 ? (
        <NoProductsEmptyState />
      ) : (
        <ProductGrid products={displayProducts} categorySlug={category.slug} />
      )}
    </div>
  );
}
