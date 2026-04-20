import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContactPage from '@/app/(storefront)/contact/page';
import { buildLocationSummaries } from '@/lib/fixtures';

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

vi.mock('@/components/ContactForm', () => ({
  ContactForm: () => <div data-testid="contact-form" />,
}));

vi.mock('@/lib/repositories', () => ({
  listLocations: vi.fn(),
}));

import { listLocations } from '@/lib/repositories';

const locations = buildLocationSummaries();

beforeEach(() => {
  vi.mocked(listLocations).mockResolvedValue(locations);
});

describe('Contact page', () => {
  it('renders one phone link and one location link per active location', async () => {
    const page = await ContactPage();
    render(page);

    const activeLocations = locations.filter(
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

  it('does not render page-level must-be-21 section', async () => {
    const page = await ContactPage();
    render(page);

    expect(
      screen.queryByText(/important:\s*must be 21\+/i)
    ).not.toBeInTheDocument();
  });
});
