export interface ProductCategoryConfig {
  slug: string;
  label: string;
  description: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductCategorySummary = Pick<
  ProductCategoryConfig,
  'slug' | 'label' | 'order'
>;
