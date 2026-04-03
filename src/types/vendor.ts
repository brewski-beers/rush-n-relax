export interface VendorSummary {
  slug: string;
  name: string;
  descriptionSource: 'leafly' | 'vendor-provided' | 'custom';
}
