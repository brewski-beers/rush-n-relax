'use client';

import { createProduct } from './actions';
import { ProductWizardForm } from '@/components/admin/ProductWizard';
import type {
  ProductCategorySummary,
  VariantTemplate,
  VendorSummary,
} from '@/types';

interface LocationOption {
  slug: string;
  name: string;
}

interface Props {
  categories: ProductCategorySummary[];
  variantTemplates: VariantTemplate[];
  vendors: VendorSummary[];
  locations: LocationOption[];
}

export function ProductCreateForm({
  categories,
  variantTemplates,
  vendors,
  locations,
}: Props) {
  return (
    <ProductWizardForm
      mode="create"
      categories={categories}
      variantTemplates={variantTemplates}
      vendors={vendors}
      locations={locations}
      action={createProduct}
    />
  );
}
