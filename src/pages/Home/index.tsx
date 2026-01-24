import { Hero } from '@/components/Hero';
import CategoryGrid from '@/components/CategoryGrid';
import { useCategories } from '@/hooks/useCategories';
import { useNavigate } from 'react-router-dom';
import { CustomerInvite } from '@/components/CustomerInvite';
import { CreateGuestStaff } from '@/components/CreateGuestStaff';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Home Page
 * 
 * Landing page with hero section and category navigation.
 * Fetches active categories from Firestore.
 * Uses Suspense for loading states (via useCategories hook).
 */
export function Home() {
  const categories = useCategories();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const handleShopNow = () => {
    document.getElementById('category-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSignIn = () => {
    navigate('/login');
  };

  return (
    <>
      <Hero onShopNow={handleShopNow} onSignIn={handleSignIn} />
      <section className="categories-section">
        <h2>Shop by Category</h2>
        <CategoryGrid categories={categories} />
      </section>
      {user && (user.role === 'customer') && <CustomerInvite />}
      {user && (user.role === 'staff' || user.role === 'manager' || user.role === 'admin') && <CreateGuestStaff />}
    </>
  );
}
