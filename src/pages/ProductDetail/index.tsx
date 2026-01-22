import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useProductBySlug } from '@/hooks/useProductBySlug';
import type { ProductCategory } from '@/types';

const VALID_CATEGORIES: ProductCategory[] = ['flower', 'edibles', 'vapes', 'accessories'];

const CATEGORY_NAMES: Record<ProductCategory, string> = {
  flower: 'Flower',
  edibles: 'Edibles',
  vapes: 'Vapes',
  accessories: 'Accessories'
};

export function ProductDetail() {
  const { category, slug } = useParams<{ category: string; slug: string }>();
  const navigate = useNavigate();

  // Validate category
  if (!category || !VALID_CATEGORIES.includes(category as ProductCategory)) {
    return <Navigate to="/" replace />;
  }

  const validCategory = category as ProductCategory;
  const { product, loading, error } = useProductBySlug(validCategory, slug || '');

  if (loading) {
    return (
      <>
        <Header />
        <main className="main">
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p>Loading product...</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <Header />
        <main className="main">
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <h2>Product not found</h2>
            <p>{error || 'The product you are looking for does not exist.'}</p>
            <button 
              onClick={() => navigate(-1)} 
              className="cta" 
              style={{ display: 'inline-block', marginTop: '1rem' }}
            >
              Go Back
            </button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="main product-detail">
        <nav className="breadcrumb">
          <Link to="/">Home</Link>
          <span> / </span>
          <Link to={`/products/category/${validCategory}`}>{CATEGORY_NAMES[validCategory]}</Link>
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
            <p className="category">{CATEGORY_NAMES[validCategory]}</p>
            <p className="price">${product.price.toFixed(2)}</p>
            
            {(product.thcContent || product.cbdContent) && (
              <div className="potency">
                {product.thcContent && <span><strong>THC:</strong> {product.thcContent}</span>}
                {product.cbdContent && <span><strong>CBD:</strong> {product.cbdContent}</span>}
              </div>
            )}
            
            <p className="stock">
              {product.stock > 0 ? (
                <span className="in-stock">✓ {product.stock} in stock</span>
              ) : (
                <span className="out-of-stock">Out of stock</span>
              )}
            </p>
            
            {product.description && (
              <div className="description">
                <h3>About This Product</h3>
                <p>{product.description}</p>
              </div>
            )}
            
            <button 
              className="cta add-to-cart" 
              disabled={product.stock === 0}
            >
              {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
            </button>
            
            <Link to={`/products/category/${validCategory}`} className="back-link">
              ← Back to {CATEGORY_NAMES[validCategory]}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
