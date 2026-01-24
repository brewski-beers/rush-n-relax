import { Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';

/**
 * Root Layout - Top-level layout providing global providers
 * 
 * Responsibilities:
 * - AuthProvider for user authentication state
 * - QueryClientProvider for TanStack Query
 * - Top-level ErrorBoundary for catastrophic errors
 * - React Query DevTools in development
 * 
 * This layout wraps ALL routes and should NOT contain any UI elements.
 * It only provides infrastructure/context.
 */
export function RootLayout() {
  return (
    <ErrorBoundary
      fallback={
        <div className="error-container">
          <h1>Something went wrong</h1>
          <p>Please refresh the page to try again.</p>
        </div>
      }
    >
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <Outlet />
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
