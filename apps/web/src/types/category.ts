export interface ProductCategoryConfig {
  slug: string;
  label: string;
  description: string;
  order: number;
  isActive: boolean;
  /** Gate: show Cannabis Profile section in product create/edit forms */
  requiresCannabisProfile: boolean;
  /** Gate: show Nutrition Facts section in product create/edit forms */
  requiresNutritionFacts: boolean;
  /** Gate: show COA section in product create/edit forms */
  requiresCOA: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductCategorySummary = Pick<
  ProductCategoryConfig,
  | 'slug'
  | 'label'
  | 'order'
  | 'requiresCannabisProfile'
  | 'requiresNutritionFacts'
  | 'requiresCOA'
>;
