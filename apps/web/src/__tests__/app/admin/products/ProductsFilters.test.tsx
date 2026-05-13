import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

import { ProductsFilters } from '@/app/(admin)/admin/products/ProductsFilters';

const CATEGORIES = [
  { slug: 'flower', name: 'Flower' },
  { slug: 'edibles', name: 'Edibles' },
];

describe('ProductsFilters', () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  describe('given the user enters filters and submits', () => {
    it('pushes a URL with category and trimmed search query', () => {
      render(<ProductsFilters categories={CATEGORIES} initial={{}} />);

      fireEvent.change(screen.getByLabelText(/category/i), {
        target: { value: 'flower' },
      });
      fireEvent.change(screen.getByLabelText(/search/i), {
        target: { value: '  mango  ' },
      });

      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(pushMock).toHaveBeenCalledTimes(1);
      const url = pushMock.mock.calls[0][0] as string;
      expect(url).toContain('/admin/products?');
      expect(url).toContain('category=flower');
      expect(url).toContain('q=mango');
      expect(url).not.toContain('%20');
    });
  });

  describe('given the user submits with no filter values', () => {
    it('pushes the bare /admin/products URL', () => {
      render(<ProductsFilters categories={CATEGORIES} initial={{}} />);
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
      expect(pushMock).toHaveBeenCalledWith('/admin/products');
    });
  });

  describe('given the user clicks reset', () => {
    it('clears all fields and navigates to bare /admin/products', () => {
      render(
        <ProductsFilters
          categories={CATEGORIES}
          initial={{ category: 'flower', q: 'mango' }}
        />
      );

      expect(screen.getByLabelText(/category/i)).toHaveValue('flower');
      fireEvent.click(screen.getByRole('button', { name: /reset/i }));

      expect(pushMock).toHaveBeenCalledWith('/admin/products');
      expect(screen.getByLabelText(/category/i)).toHaveValue('');
      expect(screen.getByLabelText(/search/i)).toHaveValue('');
    });
  });

  describe('given initial filter values', () => {
    it('prefills the inputs from props', () => {
      render(
        <ProductsFilters
          categories={CATEGORIES}
          initial={{ category: 'edibles', q: 'gummies' }}
        />
      );

      expect(screen.getByLabelText(/category/i)).toHaveValue('edibles');
      expect(screen.getByLabelText(/search/i)).toHaveValue('gummies');
    });
  });
});
