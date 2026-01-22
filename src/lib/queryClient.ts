import { QueryClient } from '@tanstack/react-query';

/**
 * Creates and configures the QueryClient instance with default options.
 * Centralizes query configuration for consistency across the application.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Unused data is kept in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Throw errors to be caught by Error Boundaries
        throwOnError: true,
        // Retry once on failure
        retry: 1,
        // Don't refetch on window focus in development
        refetchOnWindowFocus: import.meta.env.PROD,
      },
    },
  });
}

/**
 * Singleton instance of QueryClient for the application.
 * Created once and reused throughout the app lifecycle.
 */
export const queryClient = createQueryClient();
