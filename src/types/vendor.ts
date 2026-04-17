export interface Vendor {
  id: string;
  slug: string;
  name: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  categories: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type VendorSummary = Pick<
  Vendor,
  'id' | 'slug' | 'name' | 'categories' | 'isActive'
>;
