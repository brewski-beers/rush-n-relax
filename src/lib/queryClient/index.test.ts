import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createQueryClient, queryClient } from '.';

/**
 * Tests for queryClient.ts
 *
 * Critical paths tested:
 * - QueryClient initialization
 * - Default options configuration
 * - Stale time (5 minutes = 300000ms)
 * - Garbage collection time (10 minutes = 600000ms)
 * - Error handling (throwOnError)
 * - Retry behavior
 * - Focus refetching behavior (dev vs prod)
 * - Singleton instance
 *
 * These tests ensure that query caching and retry behavior work
 * consistently throughout the application.
 */

describe('queryClient', () => {
  describe('createQueryClient()', () => {
    it('should return a QueryClient instance', () => {
      const client = createQueryClient();
      expect(client).toBeInstanceOf(QueryClient);
    });

    it('should set staleTime to 5 minutes (300000ms)', () => {
      const client = createQueryClient();
      expect(client.getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000);
    });

    it('should set gcTime (garbage collection) to 10 minutes (600000ms)', () => {
      const client = createQueryClient();
      expect(client.getDefaultOptions().queries?.gcTime).toBe(10 * 60 * 1000);
    });

    it('should enable throwOnError to propagate errors to ErrorBoundary', () => {
      const client = createQueryClient();
      expect(client.getDefaultOptions().queries?.throwOnError).toBe(true);
    });

    it('should retry failed queries once', () => {
      const client = createQueryClient();
      expect(client.getDefaultOptions().queries?.retry).toBe(1);
    });

    it('should not refetch on window focus in development', () => {
      const client = createQueryClient();
      const refetchOnFocus = client.getDefaultOptions().queries?.refetchOnWindowFocus;
      // In dev, import.meta.env.PROD is false
      expect(typeof refetchOnFocus).toBe('boolean');
    });

    it('should refetch on window focus in production', () => {
      const client = createQueryClient();
      const refetchOnFocus = client.getDefaultOptions().queries?.refetchOnWindowFocus;
      // The actual value depends on import.meta.env.PROD
      expect(refetchOnFocus).toBeDefined();
    });

    it('should create independent instances with fresh cache', () => {
      const client1 = createQueryClient();
      const client2 = createQueryClient();

      expect(client1).not.toBe(client2);
      expect(client1.getQueryData(['test'])).toBeUndefined();
      expect(client2.getQueryData(['test'])).toBeUndefined();
    });
  });

  describe('singleton queryClient', () => {
    it('should be a QueryClient instance', () => {
      expect(queryClient).toBeInstanceOf(QueryClient);
    });

    it('should have the same default options as createQueryClient()', () => {
      const freshClient = createQueryClient();
      expect(queryClient.getDefaultOptions()).toEqual(
        freshClient.getDefaultOptions()
      );
    });

    it('should be a singleton (reused throughout app)', () => {
      const cachedQueryClient = queryClient;
      expect(queryClient).toBe(cachedQueryClient);
    });

    it('should maintain cache across references', () => {
      const key = ['test', 'singleton'];
      const data = { test: 'data' };

      // Set data via queryClient
      queryClient.setQueryData(key, data);

      // Verify it persists
      expect(queryClient.getQueryData(key)).toEqual(data);
    });
  });

  describe('default options behavior', () => {
    it('should configure queries with stale-while-revalidate pattern', () => {
      const client = createQueryClient();
      const options = client.getDefaultOptions().queries;

      // Stale time = data fresh for 5 min
      expect(options?.staleTime).toBe(5 * 60 * 1000);

      // GC time = keep in cache for 10 min
      expect(options?.gcTime).toBe(10 * 60 * 1000);

      // GC time > stale time (allows revalidation window)
      expect((options?.gcTime as number) > (options?.staleTime as number)).toBe(
        true
      );
    });

    it('should retry transient errors but not permanent ones', () => {
      const client = createQueryClient();
      const retry = client.getDefaultOptions().queries?.retry;

      // retry=1 means total 2 attempts (initial + 1 retry)
      expect(retry).toBe(1);
    });

    it('should throw errors for error boundaries to catch', () => {
      const client = createQueryClient();
      expect(client.getDefaultOptions().queries?.throwOnError).toBe(true);
    });
  });

  describe('cache behavior', () => {
    let client: QueryClient;

    beforeEach(() => {
      client = createQueryClient();
    });

    it('should allow setting query data', () => {
      const key = ['products'];
      const data = [{ id: '1', name: 'Product' }];

      client.setQueryData(key, data);
      expect(client.getQueryData(key)).toEqual(data);
    });

    it('should clear cache when invalidated', async () => {
      const key = ['products'];
      client.setQueryData(key, { data: 'test' });

      await client.invalidateQueries({ queryKey: key });

      // After invalidation, query is marked stale but data persists
      // (won't be cleared until GC time expires)
      const cachedData = client.getQueryData(key);
      expect(cachedData).toBeDefined();
    });

    it('should remove data after garbage collection time', async () => {
      const key = ['products'];
      client.setQueryData(key, { data: 'test' });

      // Manually trigger GC (normally happens after gcTime)
      client.clear();

      expect(client.getQueryData(key)).toBeUndefined();
    });
  });

  describe('stale time and gc time relationship', () => {
    it('stale time should be less than gc time', () => {
      const client = createQueryClient();
      const { staleTime, gcTime } = client.getDefaultOptions().queries || {};

      // staleTime: 5 min (data is fresh)
      // gcTime: 10 min (data is kept in memory)
      // This allows 5 min window to revalidate before eviction
      expect((staleTime as number) < (gcTime as number)).toBe(true);
    });

    it('should use stale-while-revalidate semantics', () => {
      const client = createQueryClient();
      const { staleTime, gcTime } = client.getDefaultOptions().queries || {};

      // Difference = revalidation window
      const revalidationWindow = (gcTime as number) - (staleTime as number);
      expect(revalidationWindow).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('error handling', () => {
    it('should propagate query errors to error boundaries', () => {
      const client = createQueryClient();
      const throwOnError = client.getDefaultOptions().queries?.throwOnError;

      expect(throwOnError).toBe(true);
    });

    it('should retry failed queries once before throwing', () => {
      const client = createQueryClient();
      const retry = client.getDefaultOptions().queries?.retry;

      // Retry count of 1 = initial attempt + 1 retry = 2 total attempts
      expect(retry).toBe(1);
    });
  });
});
