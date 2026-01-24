import { useParams, Link, Navigate } from 'react-router-dom';
import { useProductBySlug } from '@/hooks/useProductBySlug';
import { useCategoryBySlug } from '@/hooks/useCategories';

/**
 * ProductDetail Page
 * 
 * Displays detailed information for a single product.
 * Routes by slug: /products/:categorySlug/:productSlug
 * 
 * Uses Suspense for loading and ErrorBoundary for errors (provided by PageLayout).
 */
export function ProductDetail() {
  const { categorySlug, productSlug } = useParams<{ categorySlug: string; productSlug: string }>();

  // Validate params
  if (!categorySlug || !productSlug) {
    return <Navigate to="/" replace />;
  }

  // Fetch category by slug
  const category = useCategoryBySlug(categorySlug);
  // Fetch product by slug
  const product = useProductBySlug(category.id, productSlug);

  return (
    <div className="product-detail-page">
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span> / </span>
        <Link to={`/products/category/${category.slug}`}>{category.name}</Link>
        <span> / </span>
        <span>{product.name}</span>
      </nav>

      <div className="product-detail-grid">
        <div className="product-detail-image-container">
          <img 
            src={product.imageUrl || `https://placehold.co/800x600?text=${encodeURIComponent(product.name)}`}
            alt={product.name}
            className="product-detail-image"
          />
        </div>
        
        <div className="product-detail-info">
          <h1>{product.name}</h1>
          <p className="category">{category.name}</p>
          <p className="price">${product.displayPrice.toFixed(2)}</p>
          
          {(product.thcContent || product.cbdContent) && (
            <div className="potency">
              {product.thcContent && <span><strong>THC:</strong> {product.thcContent}</span>}
              {product.cbdContent && <span><strong>CBD:</strong> {product.cbdContent}</span>}
            </div>
          )}
          
          <p className="stock">
            <span className="in-stock">✓ Available</span>
          </p>
          
          {product.description && (
            <div className="description">
              <h3>About This Product</h3>
              <p>{product.description}</p>
            </div>
          )}
          
          <button 
            className="cta add-to-cart"
          >
            Add to Cart
          </button>
          
          <Link to={`/products/category/${category.slug}`} className="back-link">
            ← Back to {category.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
