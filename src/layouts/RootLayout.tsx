import { lazy, Suspense, useState, useEffect } from 'react';
import { useRoutes } from 'react-router-dom';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { AmbientOverlay } from '../components/AmbientOverlay';
import { AgeGate } from '../components/AgeGate';

// Lazy-loaded pages for code splitting
const Home = lazy(() => import('../pages/Home'));
const About = lazy(() => import('../pages/About'));
const Locations = lazy(() => import('../pages/Locations'));
const LocationDetail = lazy(() => import('../pages/LocationDetail'));
const Contact = lazy(() => import('../pages/Contact'));

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

function RootLayoutContent() {
  const [isAgeVerified, setIsAgeVerified] = useState<boolean | null>(null);

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
  ]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="root-layout">
        <AmbientOverlay />
        <AgeGate />
        <div className={`content-wrapper ${isAgeVerified === false ? 'age-gate-blur' : ''}`}>
          {routes}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default RootLayoutContent;
