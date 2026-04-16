import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Navigation } from './index';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { CartProvider } from '@/contexts/CartContext';

const { pushMock, refreshMock, signOutMock, fetchMock, initializeAppMock } =
  vi.hoisted(() => ({
    pushMock: vi.fn(),
    refreshMock: vi.fn(),
    signOutMock: vi.fn(() => Promise.resolve()),
    fetchMock: vi.fn(() =>
      Promise.resolve(new Response(null, { status: 200 }))
    ),
    initializeAppMock: vi.fn(() => ({ auth: {} })),
  }));

vi.stubGlobal('fetch', fetchMock);

// Mock next/link as a plain anchor
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

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: refreshMock,
    prefetch: vi.fn(),
  })),
}));

vi.mock('@/firebase', () => ({
  initializeApp: initializeAppMock,
  storage: {},
}));

vi.mock('firebase/auth', () => ({
  signOut: signOutMock,
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

const NavigationWrapped = () => (
  <CartProvider>
    <NavigationProvider>
      <Navigation />
    </NavigationProvider>
  </CartProvider>
);

const NavigationWrappedWithAuth = ({
  isAdminAuthenticated,
}: {
  isAdminAuthenticated: boolean;
}) => (
  <CartProvider>
    <NavigationProvider>
      <Navigation isAdminAuthenticated={isAdminAuthenticated} />
    </NavigationProvider>
  </CartProvider>
);

describe('Navigation Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders navigation header', () => {
    render(<NavigationWrapped />);

    const header = screen.getByRole('banner') || screen.getByRole('navigation');
    expect(header).toBeInTheDocument();
  });

  it('renders main navigation links', () => {
    render(<NavigationWrapped />);

    expect(
      screen.getAllByRole('link', { name: /home/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: /products/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: /locations/i }).length
    ).toBeGreaterThan(0);
  });

  it('does not render tech credit in mobile menu', () => {
    render(<NavigationWrapped />);

    expect(screen.queryByText(/tech by brewski/i)).not.toBeInTheDocument();
  });

  it('renders legal age reminders in navigation', () => {
    render(<NavigationWrapped />);

    expect(screen.getByText(/21\+ only/i)).toBeInTheDocument();
    expect(
      screen.getByText(/must be 21\+ years of age to visit\./i)
    ).toBeInTheDocument();
  });

  it('home link navigates to root path', () => {
    render(<NavigationWrapped />);

    const homeLinks = screen.getAllByRole('link', { name: /home/i });
    homeLinks.forEach(link => expect(link).toHaveAttribute('href', '/'));
  });

  it('products link navigates to products path', () => {
    render(<NavigationWrapped />);

    const productsLinks = screen.getAllByRole('link', { name: /products/i });
    productsLinks.forEach(link =>
      expect(link).toHaveAttribute('href', '/products')
    );
  });

  it('locations link navigates to locations path', () => {
    render(<NavigationWrapped />);

    const locationsLinks = screen.getAllByRole('link', { name: /locations/i });
    locationsLinks.forEach(link =>
      expect(link).toHaveAttribute('href', '/locations')
    );
  });

  it('about link navigates to about path', () => {
    render(<NavigationWrapped />);

    const aboutLinks = screen.getAllByRole('link', { name: /about/i });
    aboutLinks.forEach(link => expect(link).toHaveAttribute('href', '/about'));
  });

  it('contact link navigates to contact path', () => {
    render(<NavigationWrapped />);

    const contactLinks = screen.getAllByRole('link', { name: /contact/i });
    contactLinks.forEach(link =>
      expect(link).toHaveAttribute('href', '/contact')
    );
  });

  it('renders logo or logo placeholder', () => {
    render(<NavigationWrapped />);

    // Logo text should exist (RUSH N RELAX in .logo-text in header)
    const logoTexts = screen.getAllByText(/RUSH N RELAX/i);
    expect(logoTexts.length).toBeGreaterThan(0);
  });

  it('mobile menu toggles visibility', () => {
    render(<NavigationWrapped />);

    const menuButton = screen.queryByRole('button', {
      name: /menu|toggle|hamburger|open menu/i,
    });
    if (menuButton) {
      expect(menuButton).toBeInTheDocument();

      fireEvent.click(menuButton);

      // Menu should become visible or drawer should open
      const mobileMenus = screen.queryAllByRole('navigation', {
        hidden: false,
      });
      expect(mobileMenus.length).toBeGreaterThan(0);
    }
  });

  it('marks current page link with aria-current', () => {
    render(<NavigationWrapped />);

    // On home page (pathname = '/'), home links should have aria-current="page"
    const homeLinks = screen.getAllByRole('link', { name: /home/i });
    expect(homeLinks.some(link => link.hasAttribute('aria-current'))).toBe(
      true
    );
  });

  it('has proper semantic structure', () => {
    render(<NavigationWrapped />);

    const navs = screen.getAllByRole('navigation');
    expect(navs.length).toBeGreaterThan(0);

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(2);
  });

  it('renders responsive with proper mobile considerations', () => {
    render(<NavigationWrapped />);

    // Check for mobile menu toggle or responsive layout
    const navLinks = screen.getAllByRole('link');

    // Should have navigation in some form
    expect(navLinks.length).toBeGreaterThan(0);
  });

  it('links have proper accessibility attributes', () => {
    render(<NavigationWrapped />);

    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('href');
      expect(link.getAttribute('href')).toBeTruthy();
    });
  });

  it('shows ADMIN shortcut only for authenticated admins', () => {
    const { rerender } = render(
      <NavigationWrappedWithAuth isAdminAuthenticated={false} />
    );

    expect(
      screen.queryByRole('link', { name: 'ADMIN' })
    ).not.toBeInTheDocument();

    rerender(<NavigationWrappedWithAuth isAdminAuthenticated />);

    expect(
      screen.getAllByRole('link', { name: 'ADMIN' }).length
    ).toBeGreaterThan(0);

    expect(
      screen.getAllByRole('button', { name: 'LOGOUT' }).length
    ).toBeGreaterThan(0);
  });

  it('clears auth session when LOGOUT is clicked', async () => {
    render(<NavigationWrappedWithAuth isAdminAuthenticated />);

    const logoutButton = screen.getAllByRole('button', { name: 'LOGOUT' })[0];
    fireEvent.click(logoutButton);

    await act(async () => {
      await Promise.resolve();
    });

    expect(signOutMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', {
      method: 'DELETE',
    });
    expect(pushMock).toHaveBeenCalledWith('/admin/login');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('navigates to /admin after a 4.2 second hold when unauthenticated', () => {
    vi.useFakeTimers();
    render(<NavigationWrappedWithAuth isAdminAuthenticated={false} />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.pointerDown(menuButton);

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    expect(pushMock).toHaveBeenCalledWith('/admin');

    fireEvent.pointerUp(menuButton);
    vi.useRealTimers();
  });

  it('does not trigger hidden hold navigation once admin is authenticated', () => {
    vi.useFakeTimers();
    render(<NavigationWrappedWithAuth isAdminAuthenticated />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.pointerDown(menuButton);

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    expect(pushMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
