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
  category: string;
  description: string;
  details: string;
  /** Firebase Storage path, e.g. products/{slug}.jpg */
  image?: string;
  /** Firebase Storage paths for the gallery (up to 5), e.g. products/{slug}/gallery/0.jpg */
  images?: string[];
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
  labResults?: LabResults;
  vendorSlug?: string;
  leaflyUrl?: string;
  pricing?: ProductPricing;
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
  | 'images'
  | 'status'
  | 'availableAt'
  | 'pricing'
>;

export interface LabResults {
  thcPercent?: number;
  cbdPercent?: number;
  terpenes?: string[];
  testDate?: string;
  labName?: string;
}

export type PricingTier =
  | 'gram'
  | 'eighth'
  | 'quarter'
  | 'half'
  | 'ounce'
  | 'unit';
export type WeightTier = 'gram' | 'eighth' | 'quarter' | 'half' | 'ounce';

export interface ProductPricing {
  /** Wholesale / COGS in cents -- owner-only */
  cost?: number;
  /** Retail selling price in cents */
  price: number;
  /** Original price in cents for strikethrough display */
  compareAtPrice?: number;
  /** Stored for admin display; computed from cost + price */
  markupPercent?: number;
  taxable: boolean;
  pricingTier: PricingTier;
  /** Weight-based tiered prices in cents -- shown for flower/pre-roll */
  tieredPricing?: Partial<Record<WeightTier, number>>;
}
