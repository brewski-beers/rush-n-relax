'use client';

/**
 * AddToCartButton — triggers cart addItem for a specific variant.
 *
 * The parent (ProductDetailClient) is responsible for:
 * - resolving the selected DisplayVariant via resolveVariantPricing
 * - passing the variant down as a prop
 *
 * This component does NOT derive pricing or availability internally.
 */

import { useCart } from '@/contexts/CartContext';
import type { DisplayVariant } from '@/lib/storefront/resolveVariantPricing';

interface AddToCartButtonProps {
  productId: string;
  productName: string;
  productImage?: string;
  selectedVariant?: DisplayVariant;
  /**
   * When true, a quantity input is shown alongside the button.
   * Set to true on the product detail page; false on grid cards.
   */
  showQtySelector?: boolean;
  className?: string;
}

export function AddToCartButton({
  productId,
  productName,
  productImage,
  selectedVariant,
  showQtySelector = false,
  className,
}: AddToCartButtonProps) {
  const { addItem } = useCart();

  const disabled = !selectedVariant || !selectedVariant.inStock;

  function handleAdd() {
    if (!selectedVariant) return;
    addItem({
      productId,
      variantId: selectedVariant.variantId,
      variantLabel: selectedVariant.label,
      name: productName,
      unitPrice: selectedVariant.price,
      image: productImage,
    });
  }

  return (
    <div
      className={`add-to-cart-wrap${showQtySelector ? ' add-to-cart-wrap--with-qty' : ''}`}
    >
      <button
        type="button"
        className={`btn btn-primary add-to-cart-btn${className ? ` ${className}` : ''}`}
        onClick={handleAdd}
        disabled={disabled}
        aria-disabled={disabled}
        aria-label={
          selectedVariant
            ? `Add ${productName} — ${selectedVariant.label} to cart`
            : 'Select a variant to add to cart'
        }
      >
        {!selectedVariant
          ? 'Select a variant'
          : !selectedVariant.inStock
            ? 'Out of Stock'
            : 'Add to Cart'}
      </button>
    </div>
  );
}
