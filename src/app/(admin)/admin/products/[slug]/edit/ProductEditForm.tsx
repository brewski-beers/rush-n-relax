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
  categories: ProductCategorySummary[];
  variantTemplates: VariantTemplate[];
  vendors: VendorSummary[];
  locations: LocationOption[];
  /** Passed from server component — true only when session role === 'owner'. */
  isOwner: boolean;
}

export function ProductEditForm({
  product,
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
      categories={categories}
      variantTemplates={variantTemplates}
      vendors={vendors}
      locations={locations}
      isOwner={isOwner}
      action={boundAction}
    />
  );
}
