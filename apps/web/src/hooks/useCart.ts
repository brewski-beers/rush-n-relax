'use client';

import { useContext } from 'react';
import { CartContext } from '@/contexts/CartContext';

/**
 * Access the cart from any client component inside CartProvider.
 * Throws if used outside CartProvider — intentional fast-fail.
 */
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return ctx;
}
