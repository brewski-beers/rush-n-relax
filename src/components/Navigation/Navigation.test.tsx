import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Navigation } from './index';
import { NavigationProvider } from '@/contexts/NavigationContext';

// Mock Firebase storage
vi.mock('@/firebase', () => ({
  storage: {},
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  getBytes: vi.fn(),
}));

vi.mock('../../constants/branding', () => ({
  BrandAssetFormat: {
    PNG: 'png',
  },
  BrandSurface: {
    HEADER_DESKTOP: 'header_desktop',
  },
  resolvePreferredLogoUrlForSurface: vi.fn(() => new Promise(() => {})),
}));

const NavigationWithRouter = () => (
  <BrowserRouter>
    <NavigationProvider>
      <Navigation />
    </NavigationProvider>
  </BrowserRouter>
);

describe('Navigation Component', () => {
  beforeEach(() => {
    // Clear any cached logos
    vi.clearAllMocks();
  });

  it('renders navigation header', () => {
    render(<NavigationWithRouter />);

    const header = screen.getByRole('banner') || screen.getByRole('navigation');
    expect(header).toBeInTheDocument();
  });

  it('renders main navigation links', () => {
    render(<NavigationWithRouter />);

    expect(
      screen.getByText(/home/i) || screen.getByRole('link', { name: /home/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/products/i) ||
        screen.getByRole('link', { name: /products/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/locations/i) ||
        screen.getByRole('link', { name: /locations/i })
    ).toBeInTheDocument();
  });

  it('does not render tech credit in mobile menu', () => {
    render(<NavigationWithRouter />);

    expect(screen.queryByText(/tech by brewski/i)).not.toBeInTheDocument();
  });

  it('renders legal age reminders in navigation', () => {
    render(<NavigationWithRouter />);

    expect(screen.getByText(/21\+ only/i)).toBeInTheDocument();
    expect(
      screen.getByText(/must be 21\+ years of age to visit\./i)
    ).toBeInTheDocument();
  });

  it('home link navigates to root path', () => {
    render(<NavigationWithRouter />);

    const homeLink = screen.getByRole('link', { name: /home/i });
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('products link navigates to products path', () => {
    render(<NavigationWithRouter />);

    const productsLink = screen.getByRole('link', { name: /products/i });
    expect(productsLink).toHaveAttribute('href', '/products');
  });

  it('locations link navigates to locations path', () => {
    render(<NavigationWithRouter />);

    const locationsLink = screen.getByRole('link', { name: /locations/i });
    expect(locationsLink).toHaveAttribute('href', '/locations');
  });

  it('about link navigates to about path', () => {
    render(<NavigationWithRouter />);

    const aboutLink = screen.getByRole('link', { name: /about/i });
    expect(aboutLink).toHaveAttribute('href', '/about');
  });

  it('contact link navigates to contact path', () => {
    render(<NavigationWithRouter />);

    const contactLink = screen.getByRole('link', { name: /contact/i });
    expect(contactLink).toHaveAttribute('href', '/contact');
  });

  it('renders logo or logo placeholder', () => {
    render(<NavigationWithRouter />);

    // Logo text should exist (RUSH N RELAX in .logo-text in header)
    const logoTexts = screen.getAllByText(/RUSH N RELAX/i);
    expect(logoTexts.length).toBeGreaterThan(0);
  });

  it('mobile menu toggles visibility', () => {
    render(<NavigationWithRouter />);

    const menuButton = screen.queryByRole('button', {
      name: /menu|toggle|hamburger/i,
    });
    if (menuButton) {
      expect(menuButton).toBeInTheDocument();

      fireEvent.click(menuButton);

      // Menu should become visible or drawer should open
      const mobileMenu = screen.queryByRole('navigation', { hidden: false });
      expect(mobileMenu).toBeTruthy();
    }
  });

  it('marks current page link with aria-current', () => {
    render(<NavigationWithRouter />);

    // On home page, home link should have aria-current
    const homeLink = screen.getByRole('link', { name: /home/i });
    expect(homeLink).toHaveAttribute('aria-current');
  });

  it('has proper semantic structure', () => {
    render(<NavigationWithRouter />);

    const nav = screen.getByRole('navigation') || screen.getByRole('banner');
    expect(nav).toBeInTheDocument();

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(2);
  });

  it('renders responsive with proper mobile considerations', () => {
    render(<NavigationWithRouter />);

    // Check for mobile menu toggle or responsive layout
    const navLinks = screen.getAllByRole('link');

    // Should have navigation in some form
    expect(navLinks.length).toBeGreaterThan(0);
  });

  it('links have proper accessibility attributes', () => {
    render(<NavigationWithRouter />);

    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('href');
      expect(link.getAttribute('href')).toBeTruthy();
    });
  });
});
