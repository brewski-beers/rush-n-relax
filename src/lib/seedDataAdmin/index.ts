import type { SeedResult } from '../seedDataUtils';
import type { Category, ProductAdmin } from '@/types';
import { adminDb, serverTimestamp } from '../firebaseAdminServer';

async function executeBatchAdmin<T>(
  documents: T[],
  collectionName: string,
  transform: (doc: T) => Record<string, unknown>
): Promise<SeedResult> {
  const batch = adminDb.batch();
  const errors: string[] = [];
  let created = 0;

  for (const item of documents) {
    try {
      const newDocRef = adminDb.collection(collectionName).doc();
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

  if (created === 0) {
    return { success: false, created: 0, errors };
  }

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

export async function seedCategoriesAdmin(
  categories: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<SeedResult> {
  if (!Array.isArray(categories) || categories.length === 0) {
    return {
      success: false,
      created: 0,
      errors: ['No categories provided to seed'],
    };
  }

  return executeBatchAdmin(categories, 'categories', (cat) => ({
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    imageUrl: cat.imageUrl,
    order: cat.order,
    isActive: cat.isActive,
    seoTitle: cat.seoTitle,
    seoDescription: cat.seoDescription,
  }));
}

export async function seedProductsAdmin(
  products: Omit<ProductAdmin, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<SeedResult> {
  if (!Array.isArray(products) || products.length === 0) {
    return {
      success: false,
      created: 0,
      errors: ['No products provided to seed'],
    };
  }

  // Ensure categories exist
  const hasCategories = await adminDb.collection('categories').limit(1).get();
  if (hasCategories.empty) {
    return {
      success: false,
      created: 0,
      errors: ['No categories found. Run seedCategories first.'],
    };
  }

  return executeBatchAdmin(products, 'products', (prod) => ({
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
}
