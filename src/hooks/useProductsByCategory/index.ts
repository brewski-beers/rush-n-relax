import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Product, ProductCategory } from '@/types';

interface UseProductsByCategoryReturn {
  products: Product[];
  loading: boolean;
  error: Error | null;
}

export default function useProductsByCategory(category: ProductCategory): UseProductsByCategoryReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const productsCollection = collection(db, 'products');
        const q = query(productsCollection, where('category', '==', category));
        const querySnapshot = await getDocs(q);

        const fetchedProducts: Product[] = [];
        querySnapshot.forEach((doc) => {
          fetchedProducts.push({ id: doc.id, ...doc.data() } as Product);
        });

        setProducts(fetchedProducts);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [category]);

  return { products, loading, error };
}
