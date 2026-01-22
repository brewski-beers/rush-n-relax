import {
  collection,
  getDocs,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { Product, ProductCategory } from '@/types';

/**
 * Repository interface for product data access.
 * Abstracts the underlying data source (Firestore, REST API, etc.)
 * following the Repository Pattern for clean architecture.
 */
export interface ProductRepository {
  /**
   * Fetch all products from the data source
   */
  getAllProducts(): Promise<Product[]>;

  /**
   * Fetch products filtered by category
   */
  getProductsByCategory(category: ProductCategory): Promise<Product[]>;

  /**
   * Fetch a single product by category and slug
   */
  getProductBySlug(
    category: ProductCategory,
    slug: string
  ): Promise<Product | null>;
}

/**
 * Firestore implementation of ProductRepository.
 * Handles all Firestore-specific logic, keeping it isolated from the UI layer.
 */
export class FirestoreProductRepository implements ProductRepository {
  constructor(private db: Firestore) {}

  async getAllProducts(): Promise<Product[]> {
    const productsCollection = collection(this.db, 'products');
    const snapshot = await getDocs(productsCollection);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[];
  }

  async getProductsByCategory(category: ProductCategory): Promise<Product[]> {
    const productsCollection = collection(this.db, 'products');
    const categoryQuery = query(
      productsCollection,
      where('category', '==', category)
    );
    const snapshot = await getDocs(categoryQuery);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[];
  }

  async getProductBySlug(
    category: ProductCategory,
    slug: string
  ): Promise<Product | null> {
    const productsCollection = collection(this.db, 'products');
    const productQuery = query(
      productsCollection,
      where('category', '==', category),
      where('slug', '==', slug)
    );
    const snapshot = await getDocs(productQuery);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Product;
  }
}
