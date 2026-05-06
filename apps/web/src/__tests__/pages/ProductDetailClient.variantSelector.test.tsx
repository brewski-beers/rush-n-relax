import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, within } from '@testing-library/react';
import { CartProvider } from '@/contexts/CartContext';
import ProductDetailClient from '@/app/(storefront)/products/[slug]/ProductDetailClient';
import type { Product, ProductVariantSpec } from '@/types/product';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/**
 * Coverage for #309 — cart: pass variantId through cart → order.
 *
 * Post-#312, pricing/availability comes from `Product.variantSpecs` keyed by
 * locationId. These tests pin:
 *   1. Variants render with their labels.
 *   2. Out-of-stock variants (qty=0 at the online location) are marked OOS.
 *   3. Selecting a variant updates the active selection (aria-pressed).
 *   4. The Add-to-Cart CTA reflects the selected variant's stock state.
 */

const ONLINE = 'online';

const baseSpecs: { [variantId: string]: ProductVariantSpec } = {
  '3-5g': {
    label: '3.5g',
    locations: { [ONLINE]: { qty: 5, price: 2800 } },
  },
  '7g': {
    label: '7g',
    locations: { [ONLINE]: { qty: 0, price: 5000 } },
  },
  '14g': {
    label: '14g',
    locations: { [ONLINE]: { qty: 5, price: 9000 } },
  },
};

const baseProduct: Product = {
  id: 'flower',
  slug: 'flower',
  name: 'Premium Flower',
  category: 'flower',
  details: 'Top-shelf indoor.',
  status: 'active',
  availableAt: ['online'],
  variants: [
    { variantId: '3-5g', label: '3.5g' },
    { variantId: '7g', label: '7g' },
    { variantId: '14g', label: '14g' },
  ],
  variantSpecs: baseSpecs,
  inStockAt: [ONLINE],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function findVariantCard(label: string): HTMLButtonElement {
  const card = screen.getByText(label).closest('button.product-variant-card');
  if (!(card instanceof HTMLButtonElement)) {
    throw new Error(`No variant card found for label "${label}"`);
  }
  return card;
}

describe('ProductDetailClient — variant selector', () => {
  it('renders one variant card per priced variant with its label', () => {
    render(
      <CartProvider>
        <ProductDetailClient
          product={baseProduct}
          relatedProducts={[]}
          onlineLocationId={ONLINE}
        />
      </CartProvider>
    );

    expect(screen.getByText('3.5g')).toBeDefined();
    expect(screen.getByText('7g')).toBeDefined();
    expect(screen.getByText('14g')).toBeDefined();
  });

  it('marks out-of-stock variants disabled and labels them "Out of stock"', () => {
    const { container } = render(
      <CartProvider>
        <ProductDetailClient
          product={baseProduct}
          relatedProducts={[]}
          onlineLocationId={ONLINE}
        />
      </CartProvider>
    );

    const sevenG = findVariantCard('7g');
    expect(sevenG.disabled).toBe(true);
    expect(sevenG.classList.contains('product-variant-card--oos')).toBe(true);
    expect(within(sevenG).getByText(/Out of stock/i)).toBeDefined();

    // In-stock variants remain enabled
    expect(findVariantCard('3.5g').disabled).toBe(false);

    // Sanity: a variant grid was rendered
    expect(container.querySelector('.product-variant-grid')).not.toBeNull();
  });

  it('updates the active selection when a different in-stock variant is clicked', () => {
    render(
      <CartProvider>
        <ProductDetailClient
          product={baseProduct}
          relatedProducts={[]}
          onlineLocationId={ONLINE}
        />
      </CartProvider>
    );

    // resolveVariantPricing sorts by price asc, so 3.5g ($28) is first/active.
    const threeFive = findVariantCard('3.5g');
    const fourteenG = findVariantCard('14g');

    expect(threeFive.getAttribute('aria-pressed')).toBe('true');
    expect(fourteenG.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(fourteenG);

    expect(threeFive.getAttribute('aria-pressed')).toBe('false');
    expect(fourteenG.getAttribute('aria-pressed')).toBe('true');
  });

  it('disables Add to Cart when the (initial) selected variant is out of stock', () => {
    // Make the lowest-price variant OOS — that is the default selection.
    const oosFirst: { [variantId: string]: ProductVariantSpec } = {
      '3-5g': {
        label: '3.5g',
        locations: { [ONLINE]: { qty: 0, price: 2800 } },
      },
      '7g': {
        label: '7g',
        locations: { [ONLINE]: { qty: 5, price: 5000 } },
      },
    };

    render(
      <CartProvider>
        <ProductDetailClient
          product={{
            ...baseProduct,
            variants: [
              { variantId: '3-5g', label: '3.5g' },
              { variantId: '7g', label: '7g' },
            ],
            variantSpecs: oosFirst,
          }}
          relatedProducts={[]}
          onlineLocationId={ONLINE}
        />
      </CartProvider>
    );

    const cta = screen.getByRole('button', {
      name: /Out of Stock/i,
    });
    expect(cta).toBeInstanceOf(HTMLButtonElement);
    expect((cta as HTMLButtonElement).disabled).toBe(true);
  });
});
