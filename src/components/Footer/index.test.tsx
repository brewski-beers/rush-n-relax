import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './index';

describe('Footer', () => {
  test('renders email addresses', () => {
    render(<Footer />);
    
    const rushEmail = screen.getByText('rush@rushnrelax.com');
    const cappsEmail = screen.getByText('capps@rushnrelax.com');
    
    expect(rushEmail).toBeInTheDocument();
    expect(cappsEmail).toBeInTheDocument();
  });

  test('email addresses are clickable', () => {
    render(<Footer />);
    
    const rushLink = screen.getByText('rush@rushnrelax.com').closest('a');
    const cappsLink = screen.getByText('capps@rushnrelax.com').closest('a');
    
    expect(rushLink).toHaveAttribute('href', 'mailto:rush@rushnrelax.com');
    expect(cappsLink).toHaveAttribute('href', 'mailto:capps@rushnrelax.com');
  });

  test('displays social media message', () => {
    render(<Footer />);
    
    expect(screen.getByText('Follow us on social')).toBeInTheDocument();
  });
});
