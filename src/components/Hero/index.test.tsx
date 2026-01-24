import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from './index';

describe('Hero', () => {
  test('displays default title', () => {
    render(<Hero />);

    expect(screen.getByRole('heading', { name: 'Shop by Category' })).toBeInTheDocument();
  });

  test('displays provided subtitle', () => {
    render(<Hero subtitle="Explore Flower, Vapes, and more." />);

    expect(screen.getByText('Explore Flower, Vapes, and more.')).toBeInTheDocument();
  });

  test('allows custom title', () => {
    render(<Hero title="Featured Collections" />);

    expect(screen.getByRole('heading', { name: 'Featured Collections' })).toBeInTheDocument();
  });

  test('renders children content', () => {
    render(
      <Hero>
        <div>Child content</div>
      </Hero>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });
});
