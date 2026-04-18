'use client';

import { updateProduct, archiveProduct } from './actions';
import { ProductEditPanel } from '@/components/admin/ProductWizard/ProductEditPanel';
import type {
  Product,
  ProductCategorySummary,
  VariantTemplate,
  VendorSummary,
} from '@/types';

interface Props {
  product: Product;
  categories: ProductCategorySummary[];
  variantTemplates: VariantTemplate[];
  vendors: VendorSummary[];
}

export function ProductEditForm({
  product,
  categories,
  variantTemplates,
  vendors,
}: Props) {
  const boundAction = updateProduct.bind(null, product.slug);
  return (
    <ProductEditPanel
      product={product}
      categories={categories}
      variantTemplates={variantTemplates}
      vendors={vendors}
      action={boundAction}
      archiveAction={archiveProduct}
    />
  );
}
