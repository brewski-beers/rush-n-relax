import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Locations from './Locations';
import { LOCATIONS } from '../constants/locations';

vi.mock('../components/AllLocationsMap', () => ({
  default: () => <div data-testid="all-locations-map" />,
}));

describe('Locations page', () => {
  it('renders one Facebook link per location card', () => {
    render(
      <MemoryRouter>
        <Locations />
      </MemoryRouter>
    );

    const facebookLinks = screen.getAllByRole('link', { name: /facebook/i });
    expect(facebookLinks).toHaveLength(LOCATIONS.length);

    facebookLinks.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('href');
    });
  });

  it('still renders location detail links', () => {
    render(
      <MemoryRouter>
        <Locations />
      </MemoryRouter>
    );

    const detailLinks = screen.getAllByRole('link', { name: /view location/i });
    expect(detailLinks).toHaveLength(LOCATIONS.length);
  });
});
