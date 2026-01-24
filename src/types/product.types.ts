/**
 * Product & Category Types
 * Role-based projections for data visibility
 */

/**
 * Category Document (Firestore)
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Product Document (Firestore)
 * Full schema - projection happens at repository layer
 */
export interface Product {
  id: string;
  categoryId: string;            // FK to categories/{categoryId}
  name: string;
  slug: string;
  description?: string;
  displayPrice: number;
  cost: number;
  markup: number;
  imageUrl?: string;
  inventory: number;             // Stock count (renamed from 'stock')
  sku: string;                   // Unique product identifier
  isActive: boolean;
  thcContent?: string;
  cbdContent?: string;
  tags?: string[];               // Internal categorization
  notes?: string;                // Admin-only notes
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Role-Based Product Projections
 */

export interface ProductGuest {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  displayPrice: number;
  imageUrl?: string;
  isActive: boolean;
  thcContent?: string;
  cbdContent?: string;
}

export interface ProductStaff extends ProductGuest {
  inventory: number;
  cost: number;
  tags?: string[];
  sku: string;
}

export interface ProductAdmin extends ProductStaff {
  markup: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AnyProduct = ProductGuest | ProductStaff | ProductAdmin;

export interface ProductWithCategory extends Product {
  category: Category;
}
