import { Link } from 'react-router-dom';
import type { Category } from '@/types';
import { usePrefetchCategoryProducts } from '@/hooks/usePrefetch';

interface CategoryGridProps {
  categories: Category[];
}

export default function CategoryGrid({ categories }: CategoryGridProps) {
  if (categories.length === 0) {
    return (
      <section id="category-grid" className="category-grid">
        <p>No categories available at this time.</p>
      </section>
    );
  }

  return (
    <section id="category-grid" className="category-grid">
      {categories.map((category) => {
        const prefetchProducts = usePrefetchCategoryProducts(category.id);
        
        return (
          <Link
            key={category.id}
            to={`/products/category/${category.slug}`}
            className="category-card grain-soft"
            onMouseEnter={prefetchProducts}
          >
            <img src={category.imageUrl} alt={category.name} />
            <div className="category-info">
              <h3>{category.name}</h3>
              <p>{category.description}</p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
