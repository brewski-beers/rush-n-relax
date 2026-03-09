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
 * Which shipping tiers this product qualifies for.
 * Enforced in checkout via validateShippingEligibility().
 * Context: hemp-derived cannabinoid products have complex carrier/state restrictions.
 */
export type ShippableCategory =
  | 'accessory'
  | 'merchandise'
  | 'cbd_topical'
  | 'cbd_tincture'
  | 'hemp_flower';

/**
 * Firestore document shape for a product.
 * Lives at: tenants/{tenantId}/products/{productId}
 */
export interface Product {
  /** Firestore document ID */
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  category: ProductCategory;
  description: string;
  details: string;
  /** Firebase Storage path, e.g. products/{slug}.jpg */
  image?: string;
  featured: boolean;
  status: ProductStatus;
  /**
   * Flagged true if this product will be affected by the Nov 12, 2026
   * federal hemp redefinition (≤0.4mg total THC per container).
   * A Cloud Function sets affected products to 'compliance-hold' on Nov 1, 2026.
   */
  federalDeadlineRisk: boolean;
  /** Which shipping programs this product qualifies for */
  shippableCategories: ShippableCategory[];
  /** Link to Certificate of Analysis — required for consumable shipping */
  coaUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductSummary = Pick<
  Product,
  'id' | 'slug' | 'name' | 'category' | 'image' | 'featured' | 'status'
>;
