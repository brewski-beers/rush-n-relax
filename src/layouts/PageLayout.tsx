import { Suspense } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

interface PageLayoutProps {
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ComponentType<FallbackProps>;
}

/**
 * Default loading fallback component
 */
function DefaultLoadingFallback() {
  return (
    <div className="page-loading">
      <div className="loading-spinner" />
      <p>Loading...</p>
    </div>
  );
}

/**
 * Default error fallback component
 */
function DefaultErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return (
    <div className="page-error">
      <h2>Oops! Something went wrong</h2>
      <p className="error-message">{message}</p>
      <button onClick={resetErrorBoundary} className="retry-button">
        Try Again
      </button>
    </div>
  );
}

/**
 * Page Layout - Wraps page content with Suspense and ErrorBoundary
 * 
 * Responsibilities:
 * - Provides Suspense boundary for data loading states
 * - Provides ErrorBoundary for error states
 * - Allows custom loading and error fallbacks per page
 * 
 * This layout enables declarative loading/error handling,
 * removing the need for manual loading/error state management in components.
 */
export function PageLayout({
  children,
  loadingFallback = <DefaultLoadingFallback />,
  errorFallback: ErrorFallback = DefaultErrorFallback,
}: PageLayoutProps) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={loadingFallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
