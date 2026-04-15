import { Card } from '@/components/Card';
import { CardGrid } from '@/components/CardGrid';
import { ProductImage } from '@/components/ProductImage';
import { Pagination } from '@/components/Pagination';
import {
  listOnlineAvailableInventory,
  listProductsByIds,
} from '@/lib/repositories';

const PAGE_SIZE = 25;

interface ProductsGridProps {
  category: string | null;
  rawPage: string | undefined;
}

export async function ProductsGrid({ category, rawPage }: ProductsGridProps) {
  const onlineInventory = await listOnlineAvailableInventory();
  const featuredIds = new Set(
    onlineInventory.filter(i => i.featured).map(i => i.productId)
  );
  const allProducts = await listProductsByIds(
    onlineInventory.map(i => i.productId)
  );

  const sorted = [
    ...allProducts.filter(p => featuredIds.has(p.id)),
    ...allProducts.filter(p => !featuredIds.has(p.id)),
  ];

  const filtered = category
    ? sorted.filter(p => p.category === category)
    : sorted;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const parsedPage = parseInt(rawPage ?? '1', 10);
  const page = Number.isFinite(parsedPage)
    ? Math.min(Math.max(1, parsedPage), totalPages)
    : 1;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <CardGrid columns="auto" gap="lg">
        {paginated.map((product, index) => (
          <Card
            key={product.id}
            variant="product"
            to={`/products/${product.slug}`}
            surface={index % 3 === 1 ? 'anchor' : 'stable'}
            elevation={index % 3 === 1 ? 'soft' : 'none'}
            motion={index % 3 === 1}
          >
            <ProductImage
              slug={product.slug}
              alt={product.name}
              path={product.image}
            />
            <div className="product-card-content">
              <div className="product-category">{product.category}</div>
              <h2>{product.name}</h2>
              <div className="product-card-cta">View Details →</div>
            </div>
          </Card>
        ))}
      </CardGrid>
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        category={category}
      />
    </>
  );
}
