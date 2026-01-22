import { Link } from 'react-router-dom';
import type { ProductCategory } from '@/types';

interface ProductGridProps {
  products: Array<{ 
    id: string; 
    name: string; 
    slug: string; 
    imageUrl: string;
    category: ProductCategory;
  }>;
}

export function ProductGrid({ products }: ProductGridProps) {
  return (
    <section className="product-grid" id="products">
      <div className="grid">
        {products.map(product => (
          <Link 
            key={product.id} 
            to={`/products/${product.category}/${product.slug}`}
            className="product"
          >
            <img src={product.imageUrl} alt={product.name} />
            <h3>{product.name}</h3>
          </Link>
        ))}
      </div>
    </section>
  );
}
