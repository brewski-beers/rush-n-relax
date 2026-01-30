import { useState } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import './SeedDataAdmin.css';

/**
 * Database Seeding Component
 * Allows admins to seed initial categories and products
 * Calls Cloud Functions which require admin authentication
 */
export function SeedDataAdmin() {
  const { user } = useAuth();
  const [seedingCategories, setSeedingCategories] = useState(false);
  const [seedingProducts, setSeedingProducts] = useState(false);
  const [categoriesResult, setCategoriesResult] = useState<string | null>(null);
  const [productsResult, setProductsResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const functions = getFunctions();

  const handleSeedCategories = async () => {
    setSeedingCategories(true);
    setError(null);
    try {
      const seedCategoriesFunction = httpsCallable(functions, 'seedCategories');
      const result = await seedCategoriesFunction({});
      const data = result.data as any;
      setCategoriesResult(
        data.success
          ? `✅ ${data.message} (${data.created} categories)`
          : `⚠️ ${data.message}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to seed categories: ${message}`);
      setCategoriesResult(null);
    } finally {
      setSeedingCategories(false);
    }
  };

  const handleSeedProducts = async () => {
    setSeedingProducts(true);
    setError(null);
    try {
      const seedProductsFunction = httpsCallable(functions, 'seedProducts');
      const result = await seedProductsFunction({});
      const data = result.data as any;
      setProductsResult(
        data.success
          ? `✅ ${data.message} (${data.created} products)`
          : `⚠️ ${data.message}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to seed products: ${message}`);
      setProductsResult(null);
    } finally {
      setSeedingProducts(false);
    }
  };

  // Only admins can seed
  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="seed-data-admin">
      <div className="seed-section">
        <h3>🌱 Seed Database</h3>
        <p className="seed-description">
          Initialize production database with categories and products. This operation is idempotent
          and will skip if data already exists.
        </p>

        {error && <div className="seed-error">{error}</div>}

        <div className="seed-actions">
          <button
            onClick={handleSeedCategories}
            disabled={seedingCategories || seedingProducts}
            className="seed-button seed-button-categories"
          >
            {seedingCategories ? '⏳ Seeding...' : '📂 Seed Categories'}
          </button>
          {categoriesResult && <div className="seed-result">{categoriesResult}</div>}
        </div>

        <div className="seed-actions">
          <button
            onClick={handleSeedProducts}
            disabled={seedingProducts || seedingCategories}
            className="seed-button seed-button-products"
          >
            {seedingProducts ? '⏳ Seeding...' : '📦 Seed Products'}
          </button>
          {productsResult && <div className="seed-result">{productsResult}</div>}
        </div>

        <div className="seed-info">
          <p>
            <strong>Note:</strong> Seeds categories first, then products. Products require categories
            to exist.
          </p>
          <p>
            <strong>Admin only:</strong> This operation is protected and requires admin authentication.
          </p>
        </div>
      </div>
    </div>
  );
}
