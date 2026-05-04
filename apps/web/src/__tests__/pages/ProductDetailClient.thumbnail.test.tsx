import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ProductDetailClient from '@/app/(storefront)/products/[slug]/ProductDetailClient';
import { buildProductDocuments } from '@/lib/fixtures';

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
    <a href={href} {...(props as object)}>
      {children}
    </a>
  ),
}));

/**
 * Regression coverage for #341: the featured image thumbnail in the gallery
 * sidebar was rendering a placeholder because the pre-resolved `heroImageUrl`
 * (already an absolute https URL) was being passed back through getStorageUrl,
 * which percent-encoded the entire URL into the storage path slot.
 */
describe('ProductDetailClient — gallery thumbnails', () => {
  it('renders the featured thumbnail with the pre-resolved hero URL (no double-encoding)', () => {
    const baseProduct = buildProductDocuments()[0];
    const product = {
      ...baseProduct,
      // Force >1 thumbnails so the strip renders.
      images: ['products/extra-1.jpg'],
    };
    const heroImageUrl =
      'https://firebasestorage.googleapis.com/v0/b/rush-n-relax.firebasestorage.app/o/products%2Fflower.jpg?alt=media';

    const { container } = render(
      <ProductDetailClient
        product={product}
        relatedProducts={[]}
        heroImageUrl={heroImageUrl}
      />
    );

    const thumbStrip = container.querySelector('.product-thumbnail-strip');
    expect(thumbStrip).not.toBeNull();

    const thumbImgs = thumbStrip!.querySelectorAll('img');
    // Featured thumbnail is index 0.
    const featuredThumb = thumbImgs[0];
    expect(featuredThumb).toBeDefined();
    const src = featuredThumb.getAttribute('src') ?? '';

    // Must be the unmodified hero URL — not double-encoded through getStorageUrl.
    expect(src).toBe(heroImageUrl);
    expect(src).not.toContain('https%3A');
  });
});
