import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { useRoutes, useLocation, Link } from 'react-router-dom';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { AmbientOverlay } from '../components/AmbientOverlay';
import { AgeGate } from '../components/AgeGate';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { NavigationProvider, useNavigation } from '../contexts/NavigationContext';

// Lazy-loaded pages for code splitting
const Home = lazy(() => import('../pages/Home'));
const About = lazy(() => import('../pages/About'));
const Locations = lazy(() => import('../pages/Locations'));
const LocationDetail = lazy(() => import('../pages/LocationDetail'));
const Contact = lazy(() => import('../pages/Contact'));
const Products = lazy(() => import('../pages/Products'));
const ProductDetail = lazy(() => import('../pages/ProductDetail'));

/**
 * Page loading placeholder during code-split download
 */
function PageFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Loading...</p>
    </div>
  );
}

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="error-container" style={{ padding: '40px', textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <p>{(error as Error)?.message || 'An unknown error occurred'}</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

/**
 * Desktop Modal Menu - Rendered at root level
 * Supports keyboard navigation (Escape to close, Tab to cycle focus)
 */
function DesktopModal() {
  const { isMenuOpen, setIsMenuOpen } = useNavigation();
  const location = useLocation();
  const modalRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
    { label: 'Locations', path: '/locations' },
    { label: 'Products', path: '/products' },
    { label: 'Contact', path: '/contact' },
  ];

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.currentTarget === e.target) {
      setIsMenuOpen(false);
    }
  };

  // Handle keyboard events (Escape, Tab focus trap)
  useEffect(() => {
    if (!isMenuOpen || !modalRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMenuOpen(false);
        return;
      }

      // Focus trap on Tab
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'a, button, [tabindex]:not([tabindex="-1"])'
        );
        
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        const activeElement = document.activeElement;

        // Shift+Tab on first element -> focus last
        if (e.shiftKey && activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
          return;
        }

        // Tab on last element -> focus first
        if (!e.shiftKey && activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Focus first link when modal opens
    const firstLink = modalRef.current?.querySelector('a') as HTMLElement;
    if (firstLink) {
      // Use setTimeout to ensure modal is rendered first
      setTimeout(() => firstLink.focus(), 0);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, setIsMenuOpen]);

  if (!isMenuOpen) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={handleBackdropClick} />
      <div
        ref={modalRef}
        id="nav-menu"
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title" className="sr-only">Navigation Menu</h2>
        <nav className="modal-menu-items" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setIsMenuOpen(false)}
              className="modal-link"
              aria-current={location.pathname === link.path ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}

function RootLayoutContent() {
  const [isAgeVerified, setIsAgeVerified] = useState<boolean | null>(null);
  const location = useLocation();

  // Check localStorage on mount
  useEffect(() => {
    const verified = localStorage.getItem('ageVerified');
    setIsAgeVerified(verified === 'true');

    // Listen for age verification event
    const handleAgeVerified = () => {
      setIsAgeVerified(true);
    };

    window.addEventListener('ageVerified', handleAgeVerified);
    return () => window.removeEventListener('ageVerified', handleAgeVerified);
  }, []);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const routes = useRoutes([
    {
      path: '/',
      element: (
        <Suspense fallback={<PageFallback />}>
          <Home />
        </Suspense>
      ),
    },
    {
      path: '/about',
      element: (
        <Suspense fallback={<PageFallback />}>
          <About />
        </Suspense>
      ),
    },
    {
      path: '/locations',
      element: (
        <Suspense fallback={<PageFallback />}>
          <Locations />
        </Suspense>
      ),
    },
    {
      path: '/locations/:location',
      element: (
        <Suspense fallback={<PageFallback />}>
          <LocationDetail />
        </Suspense>
      ),
    },
    {
      path: '/contact',
      element: (
        <Suspense fallback={<PageFallback />}>
          <Contact />
        </Suspense>
      ),
    },
    {
      path: '/products',
      element: (
        <Suspense fallback={<PageFallback />}>
          <Products />
        </Suspense>
      ),
    },
    {
      path: '/products/:slug',
      element: (
        <Suspense fallback={<PageFallback />}>
          <ProductDetail />
        </Suspense>
      ),
    },
  ]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="root-layout">
        <AmbientOverlay />
        <AgeGate />
        <Navigation />
        <DesktopModal />
        <div className={`content-wrapper ${isAgeVerified === false ? 'age-gate-blur' : ''}`}>
          {routes}
        </div>
        <Footer />
      </div>
    </ErrorBoundary>
  );
}

function Root() {
  return (
    <NavigationProvider>
      <RootLayoutContent />
    </NavigationProvider>
  );
}

export default Root;
