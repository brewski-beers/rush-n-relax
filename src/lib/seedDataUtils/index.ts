/**
 * Seed data utilities - Pure business logic
 * Decoupled from Firebase implementation details
 * Can be tested independently of Firebase
 *
 * This module provides all seed functionality but delegates
 * Firebase operations through the firebaseAdmin module.
 */

import { collection, writeBatch, serverTimestamp, getDocs, doc as createDocRef } from 'firebase/firestore';
import { getFirebaseDb } from '../firebaseAdmin';
import type { Category, ProductAdmin } from '@/types';

/**
 * Result of a batch seed operation
 */
export interface SeedResult {
  success: boolean;
  created: number;
  errors: string[];
}

/**
 * Write batch helper - abstracted from Firebase specifics
 * Pure function that handles batch operations
 *
 * @param documents - Array of documents to write
 * @param collectionName - Name of Firestore collection
 * @param transform - Function to transform document data
 * @returns Promise with results (created count, errors)
 * @throws If batch commit fails
 */
async function executeBatch<T>(
  documents: T[],
  collectionName: string,
  transform: (doc: T) => Record<string, unknown>
): Promise<SeedResult> {
  const db = getFirebaseDb(); // Lazy load only when needed
  const batch = writeBatch(db);
  const collectionRef = collection(db, collectionName);
  const errors: string[] = [];
  let created = 0;

  // Queue documents for batch write
  for (const item of documents) {
    try {
      const newDocRef = createDocRef(collectionRef);
      const timestamp = serverTimestamp();

      batch.set(newDocRef, {
        ...transform(item),
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      created++;
    } catch (error) {
      errors.push(
        `Failed to queue ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Only commit if there are documents to write
  if (created === 0) {
    return { success: false, created: 0, errors };
  }

  // Commit the batch
  try {
    await batch.commit();
  } catch (error) {
    return {
      success: false,
      created: 0,
      errors: [
        `Failed to commit batch: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  return { success: errors.length === 0, created, errors };
}

/**
 * Seed categories collection
 * Pure function - no side effects except database writes
 * Validates data before attempting to seed
 *
 * @param categories - Array of category data to seed
 * @returns Promise with seed result (success, count, errors)
 */
export async function seedCategories(
  categories: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<SeedResult> {
  // Validate input
  if (!Array.isArray(categories)) {
    return {
      success: false,
      created: 0,
      errors: ['Input must be an array of categories'],
    };
  }

  if (categories.length === 0) {
    return {
      success: false,
      created: 0,
      errors: ['No categories provided to seed'],
    };
  }

  try {
    const result = await executeBatch(categories, 'categories', (cat) => ({
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.imageUrl,
      order: cat.order,
      isActive: cat.isActive,
      seoTitle: cat.seoTitle,
      seoDescription: cat.seoDescription,
    }));

    return result;
  } catch (error) {
    return {
      success: false,
      created: 0,
      errors: [
        `Unexpected error seeding categories: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

/**
 * Verify categories exist before seeding products
 * Prevents orphaned products without categories
 * Pure function - only performs read
 *
 * @returns Promise that resolves to true if categories exist
 */
export async function verifyCategoriesExist(): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const snapshot = await getDocs(collection(db, 'categories'));
    return !snapshot.empty;
  } catch (error) {
    console.error(
      'Error verifying categories:',
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

/**
 * Seed products collection
 * Pure function - validates categories exist first
 * Prevents orphaned data and ensures referential integrity
 *
 * @param products - Array of product data to seed
 * @returns Promise with seed result (success, count, errors)
 */
export async function seedProducts(
  products: Omit<ProductAdmin, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<SeedResult> {
  // Validate input
  if (!Array.isArray(products)) {
    return {
      success: false,
      created: 0,
      errors: ['Input must be an array of products'],
    };
  }

  if (products.length === 0) {
    return {
      success: false,
      created: 0,
      errors: ['No products provided to seed'],
    };
  }

  // Verify categories exist (prevents orphaned products)
  const categoriesExist = await verifyCategoriesExist();
  if (!categoriesExist) {
    return {
      success: false,
      created: 0,
      errors: [
        'No categories found. Run seedCategories() first to ensure referential integrity.',
      ],
    };
  }

  try {
    const result = await executeBatch(products, 'products', (prod) => ({
      categoryId: prod.categoryId,
      name: prod.name,
      slug: prod.slug,
      description: prod.description,
      displayPrice: prod.displayPrice,
      cost: prod.cost,
      imageUrl: prod.imageUrl,
      inventory: prod.inventory,
      sku: prod.sku,
      thcContent: prod.thcContent,
      cbdContent: prod.cbdContent,
      isActive: prod.isActive,
      tags: prod.tags || [],
      notes: prod.notes || '',
      markup: prod.markup || 0,
    }));

    return result;
  } catch (error) {
    return {
      success: false,
      created: 0,
      errors: [
        `Unexpected error seeding products: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}
