import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProductGrid } from './index';

describe('ProductGrid', () => {
  test('renders all products', () => {
    const products = [
      { id: '1', name: 'Product A', slug: 'product-a', imageUrl: 'https://example.com/a.jpg', category: 'flower' as const },
      { id: '2', name: 'Product B', slug: 'product-b', imageUrl: 'https://example.com/b.jpg', category: 'edibles' as const },
    ];
    
    render(
      <BrowserRouter>
        <ProductGrid products={products} />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('Product B')).toBeInTheDocument();
  });

  test('renders empty grid when no products', () => {
    render(
      <BrowserRouter>
        <ProductGrid products={[]} />
      </BrowserRouter>
    );
    
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('renders correct number of product images', () => {
    const products = [
      { id: '1', name: 'Product A', slug: 'product-a', imageUrl: 'https://example.com/a.jpg', category: 'flower' as const },
      { id: '2', name: 'Product B', slug: 'product-b', imageUrl: 'https://example.com/b.jpg', category: 'vapes' as const },
      { id: '3', name: 'Product C', slug: 'product-c', imageUrl: 'https://example.com/c.jpg', category: 'accessories' as const },
    ];
    
    render(
      <BrowserRouter>
        <ProductGrid products={products} />
      </BrowserRouter>
    );
    
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(3);
  });

  test('has products section id for navigation', () => {
    render(
      <BrowserRouter>
        <ProductGrid products={[]} />
      </BrowserRouter>
    );
    
    const section = document.getElementById('products');
    expect(section).toBeInTheDocument();
  });

  test('generates hierarchical URLs with category', () => {
    const products = [
      { id: '1', name: 'Product A', slug: 'product-a', imageUrl: 'https://example.com/a.jpg', category: 'flower' as const },
    ];
    
    render(
      <BrowserRouter>
        <ProductGrid products={products} />
      </BrowserRouter>
    );
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/products/flower/product-a');
  });
});
