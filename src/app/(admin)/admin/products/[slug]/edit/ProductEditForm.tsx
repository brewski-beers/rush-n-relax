'use client';

import { updateProduct } from './actions';
import { ProductWizardForm } from '@/components/admin/ProductWizard';
import type {
  Product,
  ProductCategorySummary,
  VariantTemplate,
  VendorSummary,
} from '@/types';

interface LocationOption {
  slug: string;
  name: string;
}

interface Props {
  product: Product;
  /** The category summary matching product.category — used to pre-gate form sections */
  initialCategory?: ProductCategorySummary;
  categories: ProductCategorySummary[];
  variantTemplates: VariantTemplate[];
  vendors: VendorSummary[];
  locations: LocationOption[];
  isOwner: boolean;
}

export function ProductEditForm({
  product,
  initialCategory,
  categories,
  variantTemplates,
  vendors,
  locations,
  isOwner,
}: Props) {
  const boundAction = updateProduct.bind(null, product.slug);

  return (
    <ProductWizardForm
      mode="edit"
      product={product}
      initialCategory={initialCategory}
      categories={categories}
      variantTemplates={variantTemplates}
      vendors={vendors}
      locations={locations}
      isOwner={isOwner}
      action={boundAction}
    />
  );
}
