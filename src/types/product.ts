export type ProductStatus =
  | 'active'
  | 'pending-reformulation'
  | 'archived'
  | 'compliance-hold';

export type ProductStrain = 'indica' | 'sativa' | 'hybrid' | 'cbd';

export interface LabResults {
  thcPercent?: number;
  cbdPercent?: number;
  terpenes?: string[];
  /** ISO date string, e.g. "2025-01-15" */
  testDate?: string;
  labName?: string;
}

/**
 * FDA-style Nutrition Facts for edible products.
 * All per-serving macronutrient fields are optional strings matching FDA label conventions.
 */
export interface NutritionFacts {
  /** e.g. "1 gummy (5g)" */
  servingSize: string;
  servingsPerContainer: number;
  calories: number;
  totalFat?: string;
  sodium?: string;
  totalCarbs?: string;
  sugars?: string;
  protein?: string;
}

/**
 * A single purchasable variant of a product (e.g. "1/8 oz", "10mg gummy").
 * Variants are authored at the product level and priced at the inventory level
 * via InventoryItem.variantPricing.
 */
export interface ProductVariant {
  variantId: string;
  label: string;
  weight?: { value: number; unit: 'g' | 'oz' };
  quantity?: number;
  dose?: { value: number; unit: 'mg' | 'mcg' };
}

/**
 * Firestore document shape for a product.
 * Lives at: products/{slug}
 *
 * Visibility and featuring are controlled at the inventory level
 * (inventory/{locationId}/items/{productId}.featured), not here.
 * Pricing is controlled at the inventory level via InventoryItem.variantPricing.
 */
export interface Product {
  /** Firestore document ID (same as slug) */
  id: string;
  slug: string;
  name: string;
  category: string;
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
  /** References vendors/{slug} */
  vendorSlug?: string;
  /** RnR-owned lab result data (replaces generic coaUrl where available) */
  labResults?: LabResults;
  /** Leafly product page URL */
  leaflyUrl?: string;
  /** Cannabis strain type — powers strain badge on storefront */
  strain?: ProductStrain;
  /** Consumer-facing effect descriptors, e.g. ['Euphoria', 'Relaxed', 'Sedative'] */
  effects?: string[];
  /** Flavor descriptors, e.g. ['Citrus', 'Pine', 'Earthy'] */
  flavors?: string[];
  /**
   * Purchasable size/dose variants for this product.
   * Priced per-variant at the inventory level via InventoryItem.variantPricing.
   */
  variants?: ProductVariant[];
  /** FDA-style nutrition facts -- edibles only. */
  nutritionFacts?: NutritionFacts;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductSummary = Pick<
  Product,
  | 'id'
  | 'slug'
  | 'name'
  | 'category'
  | 'image'
  | 'images'
  | 'status'
  | 'availableAt'
  | 'vendorSlug'
  | 'strain'
  | 'variants'
  | 'leaflyUrl'
>;
