'use client';

import { createProduct } from './actions';
import { ProductWizardForm } from '@/components/admin/ProductWizard';
import type {
  ProductCategorySummary,
  VariantTemplate,
  VendorSummary,
} from '@/types';

interface Props {
  categories: ProductCategorySummary[];
  variantTemplates: VariantTemplate[];
  vendors: VendorSummary[];
}

export function ProductCreateForm({
  categories,
  variantTemplates,
  vendors,
}: Props) {
  return (
    <ProductWizardForm
      mode="create"
      categories={categories}
      variantTemplates={variantTemplates}
      vendors={vendors}
      action={createProduct}
    />
  );
}
