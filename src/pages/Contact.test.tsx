import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Contact from './Contact';
import { LOCATIONS } from '../constants/locations';

vi.mock('../components/ContactForm', () => ({
  ContactForm: () => <div data-testid="contact-form" />,
}));

describe('Contact page', () => {
  it('renders one phone link and one location link per active location', () => {
    render(
      <MemoryRouter>
        <Contact />
      </MemoryRouter>
    );

    const activeLocations = LOCATIONS.filter(
      location => location.hours !== 'Coming soon'
    );
    const phoneLinks = screen.getAllByRole('link', {
      name: /^\+1\s*\(/i,
    });
    const locationLinks = screen.getAllByRole('link', {
      name: /view location/i,
    });

    expect(phoneLinks).toHaveLength(activeLocations.length);
    expect(locationLinks).toHaveLength(activeLocations.length);

    phoneLinks.forEach(link => {
      expect(link).toHaveAttribute('href');
      expect(link.getAttribute('href')).toMatch(/^tel:/);
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
