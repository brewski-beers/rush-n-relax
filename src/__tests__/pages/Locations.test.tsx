import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LocationsPage from '@/app/(storefront)/locations/page';
import { LOCATIONS } from '@/constants/locations';
import type { LocationSummary } from '@/types';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(props as object)}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/repositories', () => ({
  listLocations: vi.fn(),
}));

import { listLocations } from '@/lib/repositories';

beforeEach(() => {
  vi.mocked(listLocations).mockResolvedValue(
    LOCATIONS as unknown as LocationSummary[]
  );
});

describe('Locations page', () => {
  it('renders one phone link per location card', async () => {
    const page = await LocationsPage();
    render(page);

    const phoneLinks = screen.getAllByRole('link', { name: /^\+1/ });
    expect(phoneLinks).toHaveLength(LOCATIONS.length);

    phoneLinks.forEach(link => {
      expect(link).toHaveAttribute('href');
      expect(link.getAttribute('href')).toMatch(/^tel:/);
    });
  });

  it('still renders location detail links', async () => {
    const page = await LocationsPage();
    render(page);

    // Check that location cards are rendered and clickable (they contain "View Location" text)
    const locationCards = screen.getAllByText(/View Location/);
    expect(locationCards).toHaveLength(LOCATIONS.length);
  });
});
