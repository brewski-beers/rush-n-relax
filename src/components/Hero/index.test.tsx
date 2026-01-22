import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Hero } from './index';

describe('Hero', () => {
  test('calls onShopNow when button clicked', () => {
    const onShopNow = vi.fn();
    render(<Hero onShopNow={onShopNow} />);
    
    fireEvent.click(screen.getByText('Shop Now'));
    
    expect(onShopNow).toHaveBeenCalledOnce();
  });

  test('displays tagline', () => {
    render(<Hero onShopNow={() => {}} />);
    
    expect(screen.getByText(/Cannabis is more than a product/)).toBeInTheDocument();
  });

  test('displays main heading', () => {
    render(<Hero onShopNow={() => {}} />);
    
    expect(screen.getByRole('heading', { name: 'Rush N Relax' })).toBeInTheDocument();
  });
});
