import type { VariantGroup } from './product';

/**
 * A saved variant-group template. Stores a single VariantGroup definition
 * so admins can quickly stamp a preconfigured dimension (e.g. "Flower Weights")
 * onto a new product.
 */
export interface VariantTemplate {
  id: string; // Firestore doc ID (auto-generated)
  key: string; // unique slug, e.g. "flower-weights"
  label: string; // display name, e.g. "Flower (weight)"
  /** The full group definition — applied as a single group when the template chip is clicked. */
  group: VariantGroup;
  createdAt: Date;
  updatedAt: Date;
}
