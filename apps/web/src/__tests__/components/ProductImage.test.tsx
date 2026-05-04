import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductImage } from '@/components/ProductImage';

describe('ProductImage (pure display)', () => {
  describe('Given no src is provided', () => {
    it('renders the placeholder', () => {
      render(<ProductImage alt="Sample" />);
      expect(screen.queryByRole('img')).toBeNull();
      expect(
        document.querySelector('.product-image-placeholder')
      ).not.toBeNull();
    });
  });

  describe('Given a pre-resolved src is provided', () => {
    it('renders the <img> immediately with that src — no async resolution', () => {
      render(
        <ProductImage
          alt="Sample"
          src="https://firebasestorage.googleapis.com/v0/b/x/o/products%2Fsample.jpg?alt=media"
        />
      );
      const img = screen.getByRole('img', { name: 'Sample' });
      expect(img.getAttribute('src')).toContain('products%2Fsample.jpg');
    });

    it('falls back to the placeholder if the <img> errors', () => {
      render(
        <ProductImage alt="Sample" src="https://example.com/missing.jpg" />
      );
      const img = screen.getByRole('img', { name: 'Sample' });
      fireEvent.error(img);
      expect(screen.queryByRole('img')).toBeNull();
      expect(
        document.querySelector('.product-image-placeholder')
      ).not.toBeNull();
    });
  });
});
