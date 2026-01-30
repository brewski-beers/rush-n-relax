import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './index';

describe('Footer', () => {
  test('renders email addresses', () => {
    render(<Footer />);
    
    const email = screen.getByText('hello@example.com');
    expect(email).toBeInTheDocument();
  });

  test('email addresses are clickable', () => {
    render(<Footer />);
    
    const emailLink = screen.getByText('hello@example.com').closest('a');
    expect(emailLink).toHaveAttribute('href', 'mailto:hello@example.com');
  });

  test('displays social media message', () => {
    render(<Footer />);
    
    expect(screen.getByText('Follow us on social')).toBeInTheDocument();
  });
});
