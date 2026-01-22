interface ProductGridProps {
  products: Array<{ id: string; name: string; imageUrl: string }>;
}

export function ProductGrid({ products }: ProductGridProps) {
  return (
    <section className="product-grid" id="products">
      <h2>Featured Products</h2>
      <div className="grid">
        {products.map(product => (
          <div key={product.id} className="product">
            <img src={product.imageUrl} alt={product.name} />
            <h3>{product.name}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}
