import { Hero } from '@/components/Hero';
import CategoryGrid from '@/components/CategoryGrid';
import { useCategories } from '@/hooks/useCategories';
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
  const { user } = useAuth();
  const categoryNames = categories.map((c) => c.name).filter(Boolean);
  const heroSubtitle = categoryNames.length
    ? `Explore ${categoryNames.slice(0, 3).join(', ')}${categoryNames.length > 3 ? ', and more.' : ''}`
    : 'Browse our curated categories below.';

  return (
    <>
      <Hero title="Shop by Category" subtitle={heroSubtitle}>
        <p className="hero-intro">Discover your next favorite strain, edible, or accessory—all in one place.</p>
        <CategoryGrid categories={categories} />
      </Hero>
      {user && (user.role === 'customer') && <CustomerInvite />}
      {user && (user.role === 'staff' || user.role === 'manager' || user.role === 'admin') && <CreateGuestStaff />}
    </>
  );
}
