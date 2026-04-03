/**
 * Unit tests for cart state logic (CartContext operations).
 * Tests pure functions extracted from CartContext.
 */

import { describe, it, expect } from 'vitest';

// ── Types ─────────────────────────────────────────────────────────────────

interface CartItem {
  productId: string;
  productName: string;
  productSlug: string;
  image?: string;
  unitPrice: number;
  quantity: number;
}

// ── Pure logic mirrors CartContext internals ───────────────────────────────

const MAX_QTY = 10;

function addItem(
  items: CartItem[],
  incoming: Omit<CartItem, 'quantity'>
): CartItem[] {
  const existing = items.find(i => i.productId === incoming.productId);
  if (existing) {
    return items.map(i =>
      i.productId === incoming.productId
        ? { ...i, quantity: Math.min(i.quantity + 1, MAX_QTY) }
        : i
    );
  }
  return [...items, { ...incoming, quantity: 1 }];
}

function removeItem(items: CartItem[], productId: string): CartItem[] {
  return items.filter(i => i.productId !== productId);
}

function updateQty(
  items: CartItem[],
  productId: string,
  quantity: number
): CartItem[] {
  if (quantity <= 0) return removeItem(items, productId);
  return items.map(i =>
    i.productId === productId
      ? { ...i, quantity: Math.min(quantity, MAX_QTY) }
      : i
  );
}

function itemCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

function total(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

// ── Fixtures ──────────────────────────────────────────────────────────────

const PRODUCT_A: Omit<CartItem, 'quantity'> = {
  productId: 'prod-a',
  productName: 'Product A',
  productSlug: 'product-a',
  unitPrice: 1000,
};

const PRODUCT_B: Omit<CartItem, 'quantity'> = {
  productId: 'prod-b',
  productName: 'Product B',
  productSlug: 'product-b',
  unitPrice: 2500,
};

describe('Cart operations', () => {
  describe('addItem', () => {
    it('adds a new item with quantity 1', () => {
      const result = addItem([], PRODUCT_A);
      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(1);
    });

    it('increments quantity when adding existing product', () => {
      let items = addItem([], PRODUCT_A);
      items = addItem(items, PRODUCT_A);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(2);
    });

    it('does not exceed MAX_QTY of 10', () => {
      const items: CartItem[] = [{ ...PRODUCT_A, quantity: 10 }];
      expect(addItem(items, PRODUCT_A)[0].quantity).toBe(10);
    });
  });

  describe('removeItem', () => {
    it('removes the item entirely', () => {
      const items: CartItem[] = [{ ...PRODUCT_A, quantity: 3 }];
      expect(removeItem(items, PRODUCT_A.productId)).toHaveLength(0);
    });

    it('does not remove other items', () => {
      const items: CartItem[] = [
        { ...PRODUCT_A, quantity: 1 },
        { ...PRODUCT_B, quantity: 1 },
      ];
      const result = removeItem(items, PRODUCT_A.productId);
      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe(PRODUCT_B.productId);
    });
  });

  describe('updateQty', () => {
    it('updates quantity', () => {
      const items: CartItem[] = [{ ...PRODUCT_A, quantity: 1 }];
      expect(updateQty(items, PRODUCT_A.productId, 5)[0].quantity).toBe(5);
    });

    it('removes item when qty = 0', () => {
      const items: CartItem[] = [{ ...PRODUCT_A, quantity: 3 }];
      expect(updateQty(items, PRODUCT_A.productId, 0)).toHaveLength(0);
    });

    it('caps at MAX_QTY', () => {
      const items: CartItem[] = [{ ...PRODUCT_A, quantity: 1 }];
      expect(updateQty(items, PRODUCT_A.productId, 99)[0].quantity).toBe(10);
    });
  });

  describe('itemCount', () => {
    it('sums all quantities', () => {
      const items: CartItem[] = [
        { ...PRODUCT_A, quantity: 3 },
        { ...PRODUCT_B, quantity: 2 },
      ];
      expect(itemCount(items)).toBe(5);
    });

    it('returns 0 for empty cart', () => {
      expect(itemCount([])).toBe(0);
    });
  });

  describe('total', () => {
    it('computes sum of unitPrice * quantity', () => {
      const items: CartItem[] = [
        { ...PRODUCT_A, quantity: 2 }, // 2000
        { ...PRODUCT_B, quantity: 1 }, // 2500
      ];
      expect(total(items)).toBe(4500);
    });

    it('returns 0 for empty cart', () => {
      expect(total([])).toBe(0);
    });
  });
});
