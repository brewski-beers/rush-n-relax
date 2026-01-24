import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CategoryGrid from './index';
import type { Category } from '@/types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

describe('CategoryGrid', () => {
  const mockCategories: Category[] = [
    {
      id: 'flower',
      slug: 'flower',
      name: 'Flower',
      description: 'Premium cannabis flower',
      imageUrl: 'https://example.com/flower.jpg',
      order: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'edibles',
      slug: 'edibles',
      name: 'Edibles',
      description: 'Delicious cannabis-infused treats',
      imageUrl: 'https://example.com/edibles.jpg',
      order: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];

  it('should render all categories', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CategoryGrid categories={mockCategories} />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Flower')).toBeInTheDocument();
    expect(screen.getByText('Edibles')).toBeInTheDocument();
  });

  it('should render category descriptions', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CategoryGrid categories={mockCategories} />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Premium cannabis flower')).toBeInTheDocument();
    expect(screen.getByText('Delicious cannabis-infused treats')).toBeInTheDocument();
  });

  it('should render correct number of images', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CategoryGrid categories={mockCategories} />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
  });

  it('should render links to category pages', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CategoryGrid categories={mockCategories} />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/products/category/flower');
    expect(links[1]).toHaveAttribute('href', '/products/category/edibles');
  });

  it('should render empty state when no categories provided', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CategoryGrid categories={[]} />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('No categories available at this time.')).toBeInTheDocument();
  });

  it('should render with category-grid section id', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CategoryGrid categories={mockCategories} />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const section = container.querySelector('#category-grid');
    expect(section).toBeInTheDocument();
  });
});
