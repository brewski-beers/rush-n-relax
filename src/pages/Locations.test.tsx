import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Locations from './Locations';
import { LOCATIONS } from '../constants/locations';

describe('Locations page', () => {
  it('renders one phone link per location card', () => {
    render(
      <MemoryRouter>
        <Locations />
      </MemoryRouter>
    );

    const phoneLinks = screen.getAllByRole('link', { name: /^\+1/ });
    expect(phoneLinks).toHaveLength(LOCATIONS.length);

    phoneLinks.forEach(link => {
      expect(link).toHaveAttribute('href');
      expect(link.getAttribute('href')).toMatch(/^tel:/);
    });
  });

  it('still renders location detail links', () => {
    render(
      <MemoryRouter>
        <Locations />
      </MemoryRouter>
    );

    // Check that location cards are rendered and clickable (they contain "View Location" text)
    const locationCards = screen.getAllByText(/View Location/);
    expect(locationCards).toHaveLength(LOCATIONS.length);
  });
});
