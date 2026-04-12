export interface Vendor {
  id: string;
  slug: string;
  name: string;
  website?: string;
  logoUrl?: string;
  descriptionSource: 'leafly' | 'custom' | 'vendor-provided';
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type VendorSummary = Pick<
  Vendor,
  'id' | 'slug' | 'name' | 'descriptionSource' | 'isActive'
>;
