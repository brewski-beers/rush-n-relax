import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { ProductGrid } from '../components/ProductGrid';

const PLACEHOLDER_PRODUCTS = [
  { id: '1', name: 'Premium Flower', imageUrl: 'https://placehold.co/300x400?text=Premium+Flower' },
  { id: '2', name: 'Edibles', imageUrl: 'https://placehold.co/300x400?text=Edibles' },
  { id: '3', name: 'Vapes', imageUrl: 'https://placehold.co/300x400?text=Vapes' },
  { id: '4', name: 'Accessories', imageUrl: 'https://placehold.co/300x400?text=Accessories' },
];

export function Home() {
  const handleShopNow = () => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Header />
      <main className="main">
        <Hero onShopNow={handleShopNow} />
        <ProductGrid products={PLACEHOLDER_PRODUCTS} />
      </main>
      <Footer />
    </>
  );
}
