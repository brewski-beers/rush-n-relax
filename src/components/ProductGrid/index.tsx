import { Link } from 'react-router-dom';

interface ProductGridProps {
  products: Array<{ 
    id: string; 
    name: string; 
    slug: string; 
    imageUrl: string;
    categoryId: string;
  }>;
  categorySlug: string;
}

export function ProductGrid({ products, categorySlug }: ProductGridProps) {
  return (
    <section className="product-grid" id="products">
      <div className="grid">
        {products.map(product => (
          <Link 
            key={product.id} 
            to={`/products/${categorySlug}/${product.slug}`}
            className="product grain-soft"
          >
            <img src={product.imageUrl} alt={product.name} />
            <h3>{product.name}</h3>
          </Link>
        ))}
      </div>
    </section>
  );
}
