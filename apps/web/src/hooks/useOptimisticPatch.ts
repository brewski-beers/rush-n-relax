'use client';

import { useCallback, useState, useTransition } from 'react';

/**
 * useOptimisticPatch — codifies the inventory optimistic-update + rollback pattern.
 *
 * Flow:
 *   1. Capture previous state.
 *   2. Apply optimistic next state immediately (UI reflects the change).
 *   3. Call the async action inside a React transition.
 *   4. On resolve → call onSuccess (server may further mutate state).
 *   5. On reject → restore previous state and surface an error.
 *
 * Generic over the state shape so it can back any inline-edit table
 * (inventory today, future admin tables tomorrow).
 */
export interface UseOptimisticPatchOptions<S> {
  initial: S;
  errorMessage?: string;
}

export interface PatchOptions<S, R> {
  optimistic: (prev: S) => S;
  action: () => Promise<R>;
  onSuccess?: (result: R, setState: (next: S) => void) => void;
  onError?: (error: unknown) => void;
  errorMessage?: string;
}

export interface UseOptimisticPatchReturn<S> {
  state: S;
  setState: (next: S) => void;
  isPending: boolean;
  error: string | null;
  clearError: () => void;
  patch: <R>(opts: PatchOptions<S, R>) => Promise<void>;
}

export function useOptimisticPatch<S>(
  options: UseOptimisticPatchOptions<S>
): UseOptimisticPatchReturn<S> {
  const { initial, errorMessage = 'Failed to update. Please try again.' } =
    options;

  const [state, setStateInternal] = useState<S>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setState = useCallback((next: S) => setStateInternal(next), []);
  const clearError = useCallback(() => setError(null), []);

  const patch = useCallback(
    <R>(opts: PatchOptions<S, R>): Promise<void> => {
      let previous!: S;
      setError(null);
      setStateInternal(prev => {
        previous = prev;
        return opts.optimistic(prev);
      });

      return new Promise<void>(resolve => {
        startTransition(async () => {
          try {
            const result = await opts.action();
            opts.onSuccess?.(result, setStateInternal);
          } catch (err) {
            setStateInternal(previous);
            setError(opts.errorMessage ?? errorMessage);
            opts.onError?.(err);
          } finally {
            resolve();
          }
        });
      });
    },
    [errorMessage]
  );

  return { state, setState, isPending, error, clearError, patch };
}
