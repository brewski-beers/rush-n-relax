'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import type { Product, ProductSummary } from '@/types';

interface AddToCartButtonProps {
  product: Pick<Product | ProductSummary, 'id' | 'slug' | 'name' | 'image'> & {
    pricing?: Product['pricing'];
    availableOnline?: boolean;
    availablePickup?: boolean;
  };
  /** Show an inline quantity selector (for detail page). Default: false */
  showQtySelector?: boolean;
  className?: string;
}

const CONFIRM_DURATION_MS = 2000;

export function AddToCartButton({
  product,
  showQtySelector = false,
  className,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [confirmed, setConfirmed] = useState(false);

  const isAvailable =
    product.pricing != null &&
    (product.availableOnline === true || product.availablePickup === true);

  const handleAdd = () => {
    if (!product.pricing) return;
    for (let i = 0; i < qty; i++) {
      addItem({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        image: product.image,
        unitPrice: product.pricing.price,
      });
    }
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), CONFIRM_DURATION_MS);
  };

  return (
    <div className={`add-to-cart-wrapper${className ? ` ${className}` : ''}`}>
      {showQtySelector && (
        <div className="add-to-cart-qty">
          <button
            type="button"
            className="cart-qty-btn"
            aria-label="Decrease quantity"
            disabled={qty <= 1 || !isAvailable}
            onClick={() => setQty(q => Math.max(1, q - 1))}
          >
            −
          </button>
          <span aria-label="Quantity">{qty}</span>
          <button
            type="button"
            className="cart-qty-btn"
            aria-label="Increase quantity"
            disabled={qty >= 10 || !isAvailable}
            onClick={() => setQty(q => Math.min(10, q + 1))}
          >
            +
          </button>
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary add-to-cart-btn"
        disabled={!isAvailable}
        aria-disabled={!isAvailable}
        onClick={handleAdd}
      >
        {confirmed ? 'Added ✓' : 'Add to Cart'}
      </button>
    </div>
  );
}
