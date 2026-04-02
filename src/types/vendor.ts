export type DescriptionSource = 'leafly' | 'custom' | 'vendor-provided';

/**
 * Firestore document shape for a vendor.
 * Lives at: vendors/{slug}
 */
export interface Vendor {
  /** Firestore document ID (same as slug) */
  id: string;
  slug: string;
  name: string;
  website?: string;
  logoUrl?: string;
  descriptionSource: DescriptionSource;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type VendorSummary = Pick<
  Vendor,
  'id' | 'slug' | 'name' | 'descriptionSource' | 'isActive'
>;
