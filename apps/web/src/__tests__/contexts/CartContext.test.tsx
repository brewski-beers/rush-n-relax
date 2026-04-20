/**
 * CartContext unit tests
 *
 * Covers:
 * - Same product + different variantId = two separate line items
 * - removeItem targets the correct variant
 * - updateQty targets the correct variant
 * - Stale localStorage (no variantId) clears without error
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { CartProvider, useCart } from '@/contexts/CartContext';

// ---- localStorage mock ---------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ---- Helpers ------------------------------------------------------------

function TestConsumer({
  onRender,
}: {
  onRender: (ctx: ReturnType<typeof useCart>) => void;
}) {
  const ctx = useCart();
  onRender(ctx);
  return null;
}

function renderCart() {
  let ctx!: ReturnType<typeof useCart>;
  const result = render(
    <CartProvider>
      <TestConsumer onRender={c => (ctx = c)} />
    </CartProvider>
  );
  return { result, getCtx: () => ctx };
}

// ---- Tests --------------------------------------------------------------

beforeEach(() => {
  localStorageMock.clear();
});

describe('CartContext \u2014 line item keying', () => {
  it('adds same product with different variantId as two separate line items', () => {
    const { getCtx } = renderCart();

    act(() => {
      getCtx().addItem({
        productId: 'flower',
        variantId: 'eighth',
        variantLabel: '3.5g',
        name: 'Premium Flower',
        unitPrice: 3000,
      });
      getCtx().addItem({
        productId: 'flower',
        variantId: 'quarter',
        variantLabel: '7g',
        name: 'Premium Flower',
        unitPrice: 5000,
      });
    });

    const items = getCtx().items;
    expect(items).toHaveLength(2);
    expect(items.find(i => i.variantId === 'eighth')).toBeTruthy();
    expect(items.find(i => i.variantId === 'quarter')).toBeTruthy();
  });

  it('increments quantity when same productId+variantId is added again', () => {
    const { getCtx } = renderCart();

    act(() => {
      getCtx().addItem({
        productId: 'flower',
        variantId: 'eighth',
        variantLabel: '3.5g',
        name: 'Premium Flower',
        unitPrice: 3000,
      });
      getCtx().addItem({
        productId: 'flower',
        variantId: 'eighth',
        variantLabel: '3.5g',
        name: 'Premium Flower',
        unitPrice: 3000,
      });
    });

    expect(getCtx().items).toHaveLength(1);
    expect(getCtx().items[0]?.quantity).toBe(2);
  });
});

describe('CartContext \u2014 removeItem', () => {
  it('removes only the targeted variant', () => {
    const { getCtx } = renderCart();

    act(() => {
      getCtx().addItem({
        productId: 'flower',
        variantId: 'eighth',
        variantLabel: '3.5g',
        name: 'Premium Flower',
        unitPrice: 3000,
      });
      getCtx().addItem({
        productId: 'flower',
        variantId: 'quarter',
        variantLabel: '7g',
        name: 'Premium Flower',
        unitPrice: 5000,
      });
    });

    act(() => {
      getCtx().removeItem('flower', 'eighth');
    });

    expect(getCtx().items).toHaveLength(1);
    expect(getCtx().items[0]?.variantId).toBe('quarter');
  });
});

describe('CartContext \u2014 updateQty', () => {
  it('updates quantity only for the targeted variant', () => {
    const { getCtx } = renderCart();

    act(() => {
      getCtx().addItem({
        productId: 'flower',
        variantId: 'eighth',
        variantLabel: '3.5g',
        name: 'Premium Flower',
        unitPrice: 3000,
      });
      getCtx().addItem({
        productId: 'flower',
        variantId: 'quarter',
        variantLabel: '7g',
        name: 'Premium Flower',
        unitPrice: 5000,
      });
    });

    act(() => {
      getCtx().updateQty('flower', 'eighth', 5);
    });

    expect(getCtx().items.find(i => i.variantId === 'eighth')?.quantity).toBe(
      5
    );
    expect(getCtx().items.find(i => i.variantId === 'quarter')?.quantity).toBe(
      1
    );
  });

  it('removes item when qty set to 0', () => {
    const { getCtx } = renderCart();

    act(() => {
      getCtx().addItem({
        productId: 'flower',
        variantId: 'eighth',
        variantLabel: '3.5g',
        name: 'Premium Flower',
        unitPrice: 3000,
      });
    });

    act(() => {
      getCtx().updateQty('flower', 'eighth', 0);
    });

    expect(getCtx().items).toHaveLength(0);
  });
});

describe('CartContext \u2014 localStorage migration guard', () => {
  it('clears cart without error when stale items lack variantId', () => {
    localStorageMock.setItem(
      'rnr_cart_v2',
      JSON.stringify([{ productId: 'flower', name: 'Flower', quantity: 1 }])
    );

    expect(() => renderCart()).not.toThrow();
    const { getCtx } = renderCart();
    expect(getCtx().items).toHaveLength(0);
  });

  it('loads valid persisted cart items that include variantId', () => {
    localStorageMock.setItem(
      'rnr_cart_v2',
      JSON.stringify([
        {
          productId: 'flower',
          variantId: 'eighth',
          variantLabel: '3.5g',
          name: 'Premium Flower',
          unitPrice: 3000,
          quantity: 2,
        },
      ])
    );

    const { getCtx } = renderCart();
    expect(getCtx().items).toHaveLength(1);
    expect(getCtx().items[0]?.variantId).toBe('eighth');
    expect(getCtx().items[0]?.quantity).toBe(2);
  });
});
