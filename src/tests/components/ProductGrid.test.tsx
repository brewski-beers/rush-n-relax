import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductGrid } from '../../components/ProductGrid';

describe('ProductGrid', () => {
  test('renders all products', () => {
    const products = [
      { id: '1', name: 'Product A', imageUrl: 'https://example.com/a.jpg' },
      { id: '2', name: 'Product B', imageUrl: 'https://example.com/b.jpg' },
    ];
    
    render(<ProductGrid products={products} />);
    
    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('Product B')).toBeInTheDocument();
  });

  test('renders empty grid when no products', () => {
    render(<ProductGrid products={[]} />);
    
    expect(screen.getByText('Featured Products')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('renders correct number of product images', () => {
    const products = [
      { id: '1', name: 'Product A', imageUrl: 'https://example.com/a.jpg' },
      { id: '2', name: 'Product B', imageUrl: 'https://example.com/b.jpg' },
      { id: '3', name: 'Product C', imageUrl: 'https://example.com/c.jpg' },
    ];
    
    render(<ProductGrid products={products} />);
    
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(3);
  });

  test('has products section id for navigation', () => {
    render(<ProductGrid products={[]} />);
    
    const section = document.getElementById('products');
    expect(section).toBeInTheDocument();
  });
});
