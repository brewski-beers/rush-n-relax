'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string;
  productName: string;
  productSlug: string;
  image?: string;
  /** Retail price in cents, snapshotted at add time */
  unitPrice: number;
  quantity: number;
}

export interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  total: number;
}

// ── Context ───────────────────────────────────────────────────────────────

export const CartContext = createContext<CartContextValue | null>(null);

// ── Constants ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'rnr-cart';
const MAX_QTY = 10;

// ── Helpers ───────────────────────────────────────────────────────────────

function loadFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    // Basic shape validation — cast justified: we validate each field below
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).productId === 'string' &&
        typeof (item as Record<string, unknown>).quantity === 'number'
    );
  } catch {
    return [];
  }
}

function saveToStorage(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  if (items.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

// ── Provider ──────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  // Lazy initializer — runs only on client (window available); returns [] during SSR
  const [items, setItems] = useState<CartItem[]>(loadFromStorage);

  // Persist on every change
  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  const addItem = useCallback((incoming: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === incoming.productId);
      if (existing) {
        return prev.map(i =>
          i.productId === incoming.productId
            ? { ...i, quantity: Math.min(i.quantity + 1, MAX_QTY) }
            : i
        );
      }
      return [...prev, { ...incoming, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  }, []);

  const updateQty = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(productId);
        return;
      }
      setItems(prev =>
        prev.map(i =>
          i.productId === productId
            ? { ...i, quantity: Math.min(quantity, MAX_QTY) }
            : i
        )
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      addItem,
      removeItem,
      updateQty,
      clearCart,
      itemCount,
      total,
    }),
    [items, addItem, removeItem, updateQty, clearCart, itemCount, total]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
