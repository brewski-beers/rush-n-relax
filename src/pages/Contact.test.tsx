import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Contact from './Contact';
import { LOCATIONS } from '../constants/locations';

vi.mock('../components/ContactForm', () => ({
  ContactForm: () => <div data-testid="contact-form" />,
}));

describe('Contact page', () => {
  it('renders one Facebook link per active location', () => {
    render(
      <MemoryRouter>
        <Contact />
      </MemoryRouter>
    );

    const activeLocations = LOCATIONS.filter(
      location => location.hours !== 'Coming soon'
    );
    const facebookLinks = screen.getAllByRole('link', { name: /facebook/i });

    expect(facebookLinks).toHaveLength(activeLocations.length);
    facebookLinks.forEach(link => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('does not render page-level must-be-21 section', () => {
    render(
      <MemoryRouter>
        <Contact />
      </MemoryRouter>
    );

    expect(
      screen.queryByText(/important:\s*must be 21\+/i)
    ).not.toBeInTheDocument();
  });
});
