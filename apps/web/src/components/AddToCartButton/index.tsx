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

import { useState, useCallback } from 'react';
import { useCart } from '@/contexts/CartContext';
import type { DisplayVariant } from '@/lib/storefront/resolveVariantPricing';
import './AddToCartButton.css';

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

/** Duration of the confirmation feedback state in milliseconds */
const CONFIRM_DURATION_MS = 1_500;

export function AddToCartButton({
  productId,
  productName,
  productImage,
  selectedVariant,
  showQtySelector = false,
  className,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const disabled = !selectedVariant || !selectedVariant.inStock;

  const handleAdd = useCallback(() => {
    if (!selectedVariant) return;
    addItem({
      productId,
      variantId: selectedVariant.variantId,
      variantLabel: selectedVariant.label,
      name: productName,
      unitPrice: selectedVariant.price,
      image: productImage,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), CONFIRM_DURATION_MS);
  }, [addItem, productId, productName, productImage, selectedVariant]);

  const label = !selectedVariant
    ? 'Select a variant'
    : !selectedVariant.inStock
      ? 'Out of Stock'
      : added
        ? 'Added ✓'
        : 'Add to Cart';

  return (
    <div
      className={`add-to-cart-wrap${showQtySelector ? ' add-to-cart-wrap--with-qty' : ''}`}
    >
      <button
        type="button"
        className={`btn btn-primary add-to-cart-btn${added ? ' add-to-cart-btn--added' : ''}${className ? ` ${className}` : ''}`}
        onClick={handleAdd}
        disabled={disabled || added}
        aria-disabled={disabled || added}
        aria-live="polite"
        aria-label={
          selectedVariant
            ? added
              ? `${productName} added to cart`
              : `Add ${productName} — ${selectedVariant.label} to cart`
            : 'Select a variant to add to cart'
        }
      >
        {label}
      </button>
    </div>
  );
}
