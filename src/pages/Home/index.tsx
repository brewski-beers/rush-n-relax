import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import CategoryGrid from '@/components/CategoryGrid';
import type { Category } from '@/types';

const CATEGORIES: Category[] = [
  {
    id: 'flower',
    name: 'Flower',
    description: 'Premium cannabis flower strains',
    imageUrl: 'https://images.unsplash.com/photo-1536415462884-6bf5e5e2f49f?w=800&h=600&fit=crop'
  },
  {
    id: 'edibles',
    name: 'Edibles',
    description: 'Delicious cannabis-infused treats',
    imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&h=600&fit=crop'
  },
  {
    id: 'vapes',
    name: 'Vapes',
    description: 'Convenient vape pens and cartridges',
    imageUrl: 'https://images.unsplash.com/photo-1606409291144-0c62e55b4fbd?w=800&h=600&fit=crop'
  },
  {
    id: 'accessories',
    name: 'Accessories',
    description: 'Essential cannabis accessories',
    imageUrl: 'https://images.unsplash.com/photo-1598575425376-efe3c0c52fdd?w=800&h=600&fit=crop'
  }
];

export function Home() {
  const handleShopNow = () => {
    document.getElementById('category-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Header />
      <main className="main">
        <Hero onShopNow={handleShopNow} />
        <section className="categories-section">
          <h2>Shop by Category</h2>
          <CategoryGrid categories={CATEGORIES} />
        </section>
      </main>
      <Footer />
    </>
  );
}
