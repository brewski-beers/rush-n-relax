import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Product, ProductCategory } from '@/types';

interface UseProductBySlugResult {
  product: Product | null;
  loading: boolean;
  error: string | null;
}

export function useProductBySlug(category: ProductCategory, slug: string): UseProductBySlugResult {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!category || !slug) {
      setError('Invalid category or product slug');
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        const productsCollection = collection(db, 'products');
        const q = query(
          productsCollection,
          where('category', '==', category),
          where('slug', '==', slug)
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setError('Product not found');
          setProduct(null);
        } else {
          const doc = snapshot.docs[0];
          setProduct({ id: doc.id, ...doc.data() } as Product);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching product:', err);
        setError('Failed to load product');
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [category, slug]);

  return { product, loading, error };
}
