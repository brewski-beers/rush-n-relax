'use client';

/**
 * CartContext — client-side cart state for the storefront.
 *
 * Cart items are keyed on a composite `productId + variantId` so that the
 * same product in different weights/sizes creates separate line items.
 *
 * localStorage migration: if stored cart items lack `variantId` the cart is
 * cleared on load (cart is ephemeral — no data loss risk).
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

export interface CartItem {
  productId: string;
  variantId: string;
  variantLabel: string;
  name: string;
  unitPrice: number;
  quantity: number;
  image?: string;
}

export interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string, variantId: string) => void;
  updateQty: (productId: string, variantId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

export const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'rnr_cart_v2';

function compositeKey(productId: string, variantId: string): string {
  return `${productId}::${variantId}`;
}

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migration guard: any item missing variantId clears the whole cart
    if (
      parsed.some(
        item => !item || typeof item !== 'object' || !('variantId' in item)
      )
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed as CartItem[];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage synchronously to avoid hydration flicker.
  // We read localStorage in a lazy initializer so the initial render always
  // has the persisted cart even before the first effect fires.
  const [items, setItems] = useState<CartItem[]>(loadCart);

  // Persist to localStorage whenever items change
  useEffect(() => {
    saveCart(items);
  }, [items]);

  const addItem = useCallback((incoming: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const key = compositeKey(incoming.productId, incoming.variantId);
      const existing = prev.find(
        i => compositeKey(i.productId, i.variantId) === key
      );
      if (existing) {
        return prev.map(i =>
          compositeKey(i.productId, i.variantId) === key
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...incoming, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: string, variantId: string) => {
    const key = compositeKey(productId, variantId);
    setItems(prev =>
      prev.filter(i => compositeKey(i.productId, i.variantId) !== key)
    );
  }, []);

  const updateQty = useCallback(
    (productId: string, variantId: string, qty: number) => {
      const key = compositeKey(productId, variantId);
      if (qty <= 0) {
        setItems(prev =>
          prev.filter(i => compositeKey(i.productId, i.variantId) !== key)
        );
      } else {
        setItems(prev =>
          prev.map(i =>
            compositeKey(i.productId, i.variantId) === key
              ? { ...i, quantity: qty }
              : i
          )
        );
      }
    },
    []
  );

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        totalItems,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
