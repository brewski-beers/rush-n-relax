import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CategoryGrid from './index';
import type { Category } from '@/types';

describe('CategoryGrid', () => {
  const mockCategories: Category[] = [
    {
      id: 'flower',
      name: 'Flower',
      description: 'Premium cannabis flower',
      imageUrl: 'https://example.com/flower.jpg'
    },
    {
      id: 'edibles',
      name: 'Edibles',
      description: 'Delicious cannabis-infused treats',
      imageUrl: 'https://example.com/edibles.jpg'
    }
  ];

  it('should render all categories', () => {
    render(
      <BrowserRouter>
        <CategoryGrid categories={mockCategories} />
      </BrowserRouter>
    );

    expect(screen.getByText('Flower')).toBeInTheDocument();
    expect(screen.getByText('Edibles')).toBeInTheDocument();
  });

  it('should render category descriptions', () => {
    render(
      <BrowserRouter>
        <CategoryGrid categories={mockCategories} />
      </BrowserRouter>
    );

    expect(screen.getByText('Premium cannabis flower')).toBeInTheDocument();
    expect(screen.getByText('Delicious cannabis-infused treats')).toBeInTheDocument();
  });

  it('should render correct number of images', () => {
    render(
      <BrowserRouter>
        <CategoryGrid categories={mockCategories} />
      </BrowserRouter>
    );

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
  });

  it('should render links to category pages', () => {
    render(
      <BrowserRouter>
        <CategoryGrid categories={mockCategories} />
      </BrowserRouter>
    );

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/products/category/flower');
    expect(links[1]).toHaveAttribute('href', '/products/category/edibles');
  });

  it('should render empty state when no categories provided', () => {
    render(
      <BrowserRouter>
        <CategoryGrid categories={[]} />
      </BrowserRouter>
    );

    expect(screen.getByText('No categories available at this time.')).toBeInTheDocument();
  });

  it('should render with category-grid section id', () => {
    const { container } = render(
      <BrowserRouter>
        <CategoryGrid categories={mockCategories} />
      </BrowserRouter>
    );

    const section = container.querySelector('#category-grid');
    expect(section).toBeInTheDocument();
  });
});
