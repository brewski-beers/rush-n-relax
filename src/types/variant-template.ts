import type { ProductVariant } from './product';

export interface VariantTemplate {
  id: string; // Firestore doc ID (auto-generated)
  key: string; // unique slug, e.g. "flower", "preroll-qty"
  label: string; // display name, e.g. "Flower (weight)"
  rows: Omit<ProductVariant, 'variantId'>[];
  createdAt: Date;
  updatedAt: Date;
}
