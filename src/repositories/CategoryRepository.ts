import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { getFirestore$ } from '@/firebase';
import type { Category } from '@/types';

/**
 * Repository interface for category data access
 */
export interface CategoryRepository {
  getAll(): Promise<Category[]>;
  getActive(): Promise<Category[]>;
  getBySlug(slug: string): Promise<Category | null>;
  getById(id: string): Promise<Category | null>;
}

/**
 * Firestore implementation of CategoryRepository
 */
export class FirestoreCategoryRepository implements CategoryRepository {
  private collectionName = 'categories';

  async getAll(): Promise<Category[]> {
    const categoriesCollection = collection(getFirestore$(), this.collectionName);
    const q = query(categoriesCollection, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Category[];
  }

  async getActive(): Promise<Category[]> {
    const categoriesCollection = collection(getFirestore$(), this.collectionName);
    const q = query(
      categoriesCollection,
      where('isActive', '==', true),
      orderBy('order', 'asc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Category[];
  }

  async getBySlug(slug: string): Promise<Category | null> {
    const categoriesCollection = collection(getFirestore$(), this.collectionName);
    const q = query(categoriesCollection, where('slug', '==', slug));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Category;
  }

  async getById(id: string): Promise<Category | null> {
    const docRef = doc(getFirestore$(), this.collectionName, id);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    return { id: snapshot.id, ...snapshot.data() } as Category;
  }
}

/**
 * Singleton instance for dependency injection
 */
export const categoryRepository = new FirestoreCategoryRepository();
