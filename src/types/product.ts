export type ProductCategory =
  | 'flower'
  | 'concentrates'
  | 'drinks'
  | 'edibles'
  | 'vapes';

export type ProductStatus =
  | 'active'
  | 'pending-reformulation'
  | 'archived'
  | 'compliance-hold';

/**
 * Firestore document shape for a product.
 * Lives at: products/{slug}
 *
 * Visibility and featuring are controlled at the inventory level
 * (inventory/{locationId}/items/{productId}.featured), not here.
 */
export interface Product {
  /** Firestore document ID (same as slug) */
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  description: string;
  details: string;
  /** Firebase Storage path, e.g. products/{slug}.jpg */
  image?: string;
  status: ProductStatus;
  /**
   * Flagged true if this product will be affected by the Nov 12, 2026
   * federal hemp redefinition (≤0.4mg total THC per container).
   * A Cloud Function sets affected products to 'compliance-hold' on Nov 1, 2026.
   */
  federalDeadlineRisk: boolean;
  /** Link to Certificate of Analysis — required for compliance documentation */
  coaUrl?: string;
  /** Location slugs where this product is carried, e.g. ['oak-ridge', 'seymour'] */
  availableAt: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type ProductSummary = Pick<
  Product,
  | 'id'
  | 'slug'
  | 'name'
  | 'category'
  | 'description'
  | 'image'
  | 'status'
  | 'availableAt'
>;
