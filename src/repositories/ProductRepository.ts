import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { getFirestore$ } from '@/firebase';
import type { 
  Product, 
  ProductGuest, 
  ProductStaff, 
  ProductAdmin,
  User 
} from '@/types';

/**
 * Repository interface for product data access.
 * Abstracts the underlying data source (Firestore, REST API, etc.)
 * following the Repository Pattern for clean architecture.
 * 
 * NOTE: Queries use Firestore document ID (immutable) instead of slug.
 * Slug is stored as metadata for display/SEO/breadcrumbs only.
 */
export interface ProductRepository {
  /**
   * ID-Based queries (primary API - use these)
   * Routes: /categories/:categoryId/products/:productId
   */
  getProductByIdAsGuest(
    categoryId: string,
    productId: string
  ): Promise<ProductGuest | null>;

  getProductByIdAsStaff(
    categoryId: string,
    productId: string,
    user: User
  ): Promise<ProductStaff | null>;

  getProductByIdAsAdmin(
    categoryId: string,
    productId: string,
    user: User
  ): Promise<ProductAdmin | null>;

  /**
   * Category product listings (by categoryId, returns products by ID)
   */
  getProductsByCategoryAsGuest(
    categoryId: string
  ): Promise<ProductGuest[]>;

  getProductsByCategoryAsStaff(
    categoryId: string,
    user: User
  ): Promise<ProductStaff[]>;

  /**
   * Legacy slug-based queries (deprecated - kept for backward compat)
   * Use getProductByIdAsGuest() instead
   */
  getProductsBySlugAsGuest(
    categoryId: string,
    slug: string
  ): Promise<ProductGuest | null>;

  getProductsBySlugAsStaff(
    categoryId: string,
    slug: string,
    user: User
  ): Promise<ProductStaff | null>;

  getProductsBySlugAsAdmin(
    categoryId: string,
    slug: string,
    user: User
  ): Promise<ProductAdmin | null>;

  /**
   * Admin queries - full schema
   */
  getAllProductsAsAdmin(user: User): Promise<ProductAdmin[]>;

  /**
   * Admin mutations
   */
  createProduct(
    product: Omit<ProductAdmin, 'id' | 'createdAt' | 'updatedAt'>,
    user: User
  ): Promise<string>;

  updateProduct(
    id: string,
    updates: Partial<ProductAdmin>,
    user: User
  ): Promise<void>;

  deleteProduct(id: string, user: User): Promise<void>;

  /**
   * Legacy methods for backward compatibility
   */
  getAllProducts(): Promise<Product[]>;
  getProductsByCategoryId(categoryId: string): Promise<Product[]>;
  getProductBySlug(
    categoryId: string,
    slug: string
  ): Promise<Product | null>;
}

/**
 * Firestore implementation of ProductRepository.
 * Projects data based on user role at the data access layer
 * to enforce security and data visibility rules.
 */
export class FirestoreProductRepository implements ProductRepository {
  // Constructor takes no db, will get it via getter on each call
  constructor() {}

  private get db(): Firestore {
    return getFirestore$();
  }

  /**
   * Private helper to fetch raw product document by ID (direct lookup)
   */
  private async fetchRawProductById(
    categoryId: string,
    productId: string,
    includeInactive = false
  ): Promise<Product | null> {
    // Direct doc lookup by categoryId + productId (fast, O(1))
    const docRef = doc(this.db, 'categories', categoryId, 'products', productId);
    const docSnap = await getDocs(collection(this.db, 'categories', categoryId, 'products'));
    
    // For now, use query pattern since subcollections require different API
    const productsCollection = collection(this.db, 'products');
    const conditions = [
      where('id', '==', productId),
      where('categoryId', '==', categoryId),
    ];
    if (!includeInactive) {
      conditions.push(where('isActive', '==', true));
    }
    const q = query(productsCollection, ...conditions);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0];
    return { id: data.id, ...data.data() } as Product;
  }

  /**
   * Private helper to fetch raw product document by slug (legacy, for backward compat)
   */
  private async fetchRawProduct(
    categoryId: string,
    slug: string,
    includeInactive = false
  ): Promise<Product | null> {
    const productsCollection = collection(this.db, 'products');
    const conditions = [
      where('categoryId', '==', categoryId),
      where('slug', '==', slug),
    ];
    if (!includeInactive) {
      conditions.push(where('isActive', '==', true));
    }
    const q = query(productsCollection, ...conditions);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Product;
  }

  /**
   * ID-based guest query - fetch product by ID (preferred)
   */
  async getProductByIdAsGuest(
    categoryId: string,
    productId: string
  ): Promise<ProductGuest | null> {
    const product = await this.fetchRawProductById(categoryId, productId);
    if (!product) return null;

    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug, // For display/breadcrumb
      description: product.description,
      displayPrice: product.displayPrice,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      thcContent: product.thcContent,
      cbdContent: product.cbdContent,
    };
  }

  /**
   * ID-based staff query
   */
  async getProductByIdAsStaff(
    categoryId: string,
    productId: string,
    user: User
  ): Promise<ProductStaff | null> {
    // Check authorization
    if (user.role !== 'staff' && user.role !== 'admin') {
      throw new Error('Unauthorized: staff access required');
    }

    const product = await this.fetchRawProductById(categoryId, productId);
    if (!product) return null;

    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      displayPrice: product.displayPrice,
      cost: product.cost,
      imageUrl: product.imageUrl,
      inventory: product.inventory,
      sku: product.sku,
      isActive: product.isActive,
      thcContent: product.thcContent,
      cbdContent: product.cbdContent,
      tags: product.tags,
    };
  }

  /**
   * ID-based admin query
   */
  async getProductByIdAsAdmin(
    categoryId: string,
    productId: string,
    user: User
  ): Promise<ProductAdmin | null> {
    // Check authorization
    if (user.role !== 'admin') {
      throw new Error('Unauthorized: admin access required');
    }

    const product = await this.fetchRawProductById(categoryId, productId, true);
    if (!product) return null;

    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      displayPrice: product.displayPrice,
      cost: product.cost,
      markup: product.markup,
      imageUrl: product.imageUrl,
      inventory: product.inventory,
      sku: product.sku,
      isActive: product.isActive,
      thcContent: product.thcContent,
      cbdContent: product.cbdContent,
      tags: product.tags,
      notes: product.notes,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /**
   * Guest query - project to ProductGuest schema (legacy slug-based)
   */
  async getProductsBySlugAsGuest(
    categoryId: string,
    slug: string
  ): Promise<ProductGuest | null> {
    const product = await this.fetchRawProduct(categoryId, slug);
    if (!product) return null;

    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      displayPrice: product.displayPrice,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      thcContent: product.thcContent,
      cbdContent: product.cbdContent,
    };
  }

  /**
   * Guest query - fetch multiple products
   */
  async getProductsByCategoryAsGuest(
    categoryId: string
  ): Promise<ProductGuest[]> {
    const productsCollection = collection(this.db, 'products');
    const q = query(
      productsCollection,
      where('categoryId', '==', categoryId),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const product = { id: doc.id, ...doc.data() } as Product;
      return {
        id: product.id,
        categoryId: product.categoryId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        displayPrice: product.displayPrice,
        imageUrl: product.imageUrl,
        isActive: product.isActive,
        thcContent: product.thcContent,
        cbdContent: product.cbdContent,
      };
    });
  }

  /**
   * Staff query - project to ProductStaff schema
   */
  async getProductsBySlugAsStaff(
    categoryId: string,
    slug: string,
    user: User
  ): Promise<ProductStaff | null> {
    if (user.role !== 'staff' && user.role !== 'manager' && user.role !== 'admin') {
      throw new Error('Access denied: staff role required');
    }

    const product = await this.fetchRawProduct(categoryId, slug, true);
    if (!product) return null;

    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      displayPrice: product.displayPrice,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      thcContent: product.thcContent,
      cbdContent: product.cbdContent,
      inventory: product.inventory,
      sku: product.sku,
      cost: product.cost,
      tags: product.tags,
    };
  }

  /**
   * Staff query - fetch multiple products
   */
  async getProductsByCategoryAsStaff(
    categoryId: string,
    user: User
  ): Promise<ProductStaff[]> {
    if (user.role !== 'staff' && user.role !== 'manager' && user.role !== 'admin') {
      throw new Error('Access denied: staff role required');
    }

    const productsCollection = collection(this.db, 'products');
    const q = query(
      productsCollection,
      where('categoryId', '==', categoryId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const product = { id: doc.id, ...doc.data() } as Product;
      return {
        id: product.id,
        categoryId: product.categoryId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        displayPrice: product.displayPrice,
        imageUrl: product.imageUrl,
        isActive: product.isActive,
        thcContent: product.thcContent,
        cbdContent: product.cbdContent,
        inventory: product.inventory,
        sku: product.sku,
        cost: product.cost,
        tags: product.tags,
      };
    });
  }

  /**
   * Admin query - full ProductAdmin schema
   */
  async getProductsBySlugAsAdmin(
    categoryId: string,
    slug: string,
    user: User
  ): Promise<ProductAdmin | null> {
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new Error('Access denied: admin role required');
    }

    const product = await this.fetchRawProduct(categoryId, slug, true);
    if (!product) return null;

    return product as unknown as ProductAdmin;
  }

  /**
   * Admin query - fetch all products
   */
  async getAllProductsAsAdmin(user: User): Promise<ProductAdmin[]> {
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new Error('Access denied: admin role required');
    }

    const productsCollection = collection(this.db, 'products');
    const snapshot = await getDocs(productsCollection);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ProductAdmin[];
  }

  /**
   * Create a new product (admin only)
   */
  async createProduct(
    product: Omit<ProductAdmin, 'id' | 'createdAt' | 'updatedAt'>,
    user: User
  ): Promise<string> {
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new Error('Access denied: admin role required');
    }

    const productsCollection = collection(this.db, 'products');
    const newDoc = doc(productsCollection);
    
    const productData = {
      ...product,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(newDoc, productData);
    return newDoc.id;
  }

  /**
   * Update an existing product (admin only)
   */
  async updateProduct(
    id: string,
    updates: Partial<ProductAdmin>,
    user: User
  ): Promise<void> {
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new Error('Access denied: admin role required');
    }

    const productDoc = doc(this.db, 'products', id);
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp(),
    };

    // Remove id if present (can't update)
    delete (updateData as any).id;

    await updateDoc(productDoc, updateData);
  }

  /**
   * Delete a product (admin only)
   */
  async deleteProduct(id: string, user: User): Promise<void> {
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new Error('Access denied: admin role required');
    }

    const productDoc = doc(this.db, 'products', id);
    await deleteDoc(productDoc);
  }

  // === Legacy methods for backward compatibility ===

  async getAllProducts(): Promise<Product[]> {
    const productsCollection = collection(this.db, 'products');
    const q = query(productsCollection, where('isActive', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[];
  }

  async getProductsByCategoryId(categoryId: string): Promise<Product[]> {
    const productsCollection = collection(this.db, 'products');
    const categoryQuery = query(
      productsCollection,
      where('categoryId', '==', categoryId),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(categoryQuery);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[];
  }

  async getProductBySlug(
    categoryId: string,
    slug: string
  ): Promise<Product | null> {
    const productsCollection = collection(this.db, 'products');
    const productQuery = query(
      productsCollection,
      where('categoryId', '==', categoryId),
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

// Export singleton instance (lazy initialization)
let _productRepository: FirestoreProductRepository | null = null;

export function getProductRepository() {
  if (!_productRepository) {
    _productRepository = new FirestoreProductRepository();
  }
  return _productRepository;
}

// For backward compatibility with existing imports like `productRepository.method()`
export const productRepository = {
  getProductByIdAsGuest: (categoryId: string, productId: string) =>
    getProductRepository().getProductByIdAsGuest(categoryId, productId),
  getProductByIdAsStaff: (categoryId: string, productId: string, user: User) =>
    getProductRepository().getProductByIdAsStaff(categoryId, productId, user),
  getProductByIdAsAdmin: (categoryId: string, productId: string, user: User) =>
    getProductRepository().getProductByIdAsAdmin(categoryId, productId, user),
  getProductsByCategoryAsGuest: (categoryId: string) =>
    getProductRepository().getProductsByCategoryAsGuest(categoryId),
  getProductsByCategoryAsStaff: (categoryId: string, user: User) =>
    getProductRepository().getProductsByCategoryAsStaff(categoryId, user),
  getProductsBySlugAsGuest: (categoryId: string, slug: string) =>
    getProductRepository().getProductsBySlugAsGuest(categoryId, slug),
  getProductsBySlugAsStaff: (categoryId: string, slug: string, user: User) =>
    getProductRepository().getProductsBySlugAsStaff(categoryId, slug, user),
  getProductsBySlugAsAdmin: (categoryId: string, slug: string, user: User) =>
    getProductRepository().getProductsBySlugAsAdmin(categoryId, slug, user),
  getAllProductsAsAdmin: (user: User) =>
    getProductRepository().getAllProductsAsAdmin(user),
  createProduct: (product: Omit<ProductAdmin, 'id' | 'createdAt' | 'updatedAt'>, user: User) =>
    getProductRepository().createProduct(product, user),
  updateProduct: (id: string, updates: Partial<ProductAdmin>, user: User) =>
    getProductRepository().updateProduct(id, updates, user),
  deleteProduct: (id: string, user: User) =>
    getProductRepository().deleteProduct(id, user),
  getAllProducts: () =>
    getProductRepository().getAllProducts(),
  getProductsByCategoryId: (categoryId: string) =>
    getProductRepository().getProductsByCategoryId(categoryId),
  getProductBySlug: (categoryId: string, slug: string) =>
    getProductRepository().getProductBySlug(categoryId, slug),
};
