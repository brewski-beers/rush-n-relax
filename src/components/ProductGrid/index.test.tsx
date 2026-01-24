import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProductGrid } from './index';

describe('ProductGrid', () => {
  test('renders all products', () => {
    const products = [
      { id: '1', name: 'Product A', slug: 'product-a', imageUrl: 'https://example.com/a.jpg', categoryId: 'flower' },
      { id: '2', name: 'Product B', slug: 'product-b', imageUrl: 'https://example.com/b.jpg', categoryId: 'edibles' },
    ];
    
    render(
      <BrowserRouter>
        <ProductGrid products={products} categorySlug="flower" />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('Product B')).toBeInTheDocument();
  });

  test('renders empty grid when no products', () => {
    render(
      <BrowserRouter>
        <ProductGrid products={[]} categorySlug="flower" />
      </BrowserRouter>
    );
    
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('renders correct number of product images', () => {
    const products = [
      { id: '1', name: 'Product A', slug: 'product-a', imageUrl: 'https://example.com/a.jpg', categoryId: 'flower' },
      { id: '2', name: 'Product B', slug: 'product-b', imageUrl: 'https://example.com/b.jpg', categoryId: 'vapes' },
      { id: '3', name: 'Product C', slug: 'product-c', imageUrl: 'https://example.com/c.jpg', categoryId: 'accessories' },
    ];
    
    render(
      <BrowserRouter>
        <ProductGrid products={products} categorySlug="flower" />
      </BrowserRouter>
    );
    
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(3);
  });

  test('has products section id for navigation', () => {
    render(
      <BrowserRouter>
        <ProductGrid products={[]} categorySlug="flower" />
      </BrowserRouter>
    );
    
    const section = document.getElementById('products');
    expect(section).toBeInTheDocument();
  });

  test('generates hierarchical URLs with category', () => {
    const products = [
      { id: '1', name: 'Product A', slug: 'product-a', imageUrl: 'https://example.com/a.jpg', categoryId: 'flower' },
    ];
    
    render(
      <BrowserRouter>
        <ProductGrid products={products} categorySlug="flower" />
      </BrowserRouter>
    );
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/products/flower/product-a');
  });
});
