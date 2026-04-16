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
  useReducer,
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

// ── Reducer ───────────────────────────────────────────────────────────────

type CartAction =
  | { type: 'HYDRATE'; items: CartItem[] }
  | { type: 'ADD'; item: Omit<CartItem, 'quantity'> }
  | { type: 'REMOVE'; productId: string; variantId: string }
  | { type: 'UPDATE_QTY'; productId: string; variantId: string; qty: number }
  | { type: 'CLEAR' };

interface CartState {
  items: CartItem[];
  hydrated: boolean;
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { items: action.items, hydrated: true };
    case 'ADD': {
      const key = compositeKey(action.item.productId, action.item.variantId);
      const existing = state.items.find(
        i => compositeKey(i.productId, i.variantId) === key
      );
      const items = existing
        ? state.items.map(i =>
            compositeKey(i.productId, i.variantId) === key
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        : [...state.items, { ...action.item, quantity: 1 }];
      return { ...state, items };
    }
    case 'REMOVE': {
      const key = compositeKey(action.productId, action.variantId);
      return {
        ...state,
        items: state.items.filter(
          i => compositeKey(i.productId, i.variantId) !== key
        ),
      };
    }
    case 'UPDATE_QTY': {
      const key = compositeKey(action.productId, action.variantId);
      if (action.qty <= 0) {
        return {
          ...state,
          items: state.items.filter(
            i => compositeKey(i.productId, i.variantId) !== key
          ),
        };
      }
      return {
        ...state,
        items: state.items.map(i =>
          compositeKey(i.productId, i.variantId) === key
            ? { ...i, quantity: action.qty }
            : i
        ),
      };
    }
    case 'CLEAR':
      return { ...state, items: [] };
    default:
      return state;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [{ items, hydrated }, dispatch] = useReducer(cartReducer, {
    items: [],
    hydrated: false,
  });

  // Hydrate from localStorage after mount (client-only, avoids hydration mismatch)
  useEffect(() => {
    dispatch({ type: 'HYDRATE', items: loadCart() });
  }, []);

  // Persist whenever items change (skip the pre-hydration empty state)
  useEffect(() => {
    if (hydrated) saveCart(items);
  }, [items, hydrated]);

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'>) => dispatch({ type: 'ADD', item }),
    []
  );

  const removeItem = useCallback(
    (productId: string, variantId: string) =>
      dispatch({ type: 'REMOVE', productId, variantId }),
    []
  );

  const updateQty = useCallback(
    (productId: string, variantId: string, qty: number) =>
      dispatch({ type: 'UPDATE_QTY', productId, variantId, qty }),
    []
  );

  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), []);

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
