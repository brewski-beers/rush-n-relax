import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { ProductGrid } from '../components/ProductGrid';
import { useProducts } from '../hooks/useProducts';

export function Home() {
  const { products, loading, error } = useProducts();
  
  const handleShopNow = () => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Format products for ProductGrid component
  const displayProducts = products.map(product => ({
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl || `https://placehold.co/300x400?text=${encodeURIComponent(product.name)}`,
  }));

  return (
    <>
      <Header />
      <main className="main">
        <Hero onShopNow={handleShopNow} />
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Loading products...</p>
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && <ProductGrid products={displayProducts} />}
      </main>
      <Footer />
    </>
  );
}
