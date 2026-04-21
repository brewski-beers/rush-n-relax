import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useOptimisticPatch } from './useOptimisticPatch';

interface Row {
  quantity: number;
  inStock: boolean;
}

describe('useOptimisticPatch', () => {
  it('initializes with the provided state and no error', () => {
    const { result } = renderHook(() =>
      useOptimisticPatch<Row>({ initial: { quantity: 5, inStock: true } })
    );
    expect(result.current.state).toEqual({ quantity: 5, inStock: true });
    expect(result.current.error).toBeNull();
    expect(result.current.isPending).toBe(false);
  });

  it('applies optimistic state immediately, then resolves successfully', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useOptimisticPatch<Row>({ initial: { quantity: 5, inStock: true } })
    );

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.patch({
        optimistic: prev => ({ ...prev, quantity: 10 }),
        action,
        onSuccess,
      });
    });

    // Optimistic state is visible before the action settles.
    expect(result.current.state.quantity).toBe(10);

    await act(async () => {
      await pending;
    });

    expect(action).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(result.current.state.quantity).toBe(10);
    expect(result.current.error).toBeNull();
  });

  it('rolls back state and surfaces the error when the action rejects', async () => {
    const action = vi.fn().mockRejectedValue(new Error('boom'));
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useOptimisticPatch<Row>({ initial: { quantity: 5, inStock: true } })
    );

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.patch({
        optimistic: prev => ({ ...prev, quantity: 0, inStock: false }),
        action,
        onError,
      });
    });

    expect(result.current.state).toEqual({ quantity: 0, inStock: false });

    await act(async () => {
      await pending;
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({ quantity: 5, inStock: true });
    });
    expect(result.current.error).toBe('Failed to update. Please try again.');
    expect(onError).toHaveBeenCalledOnce();
  });

  it('allows onSuccess to further mutate state from the server response', async () => {
    const action = vi.fn().mockResolvedValue({ quantity: 12 });
    const { result } = renderHook(() =>
      useOptimisticPatch<Row>({ initial: { quantity: 5, inStock: true } })
    );

    await act(async () => {
      await result.current.patch<{ quantity: number }>({
        optimistic: prev => ({ ...prev, quantity: 10 }),
        action,
        onSuccess: (res, setState) => {
          setState({ quantity: res.quantity, inStock: res.quantity > 0 });
        },
      });
    });

    expect(result.current.state).toEqual({ quantity: 12, inStock: true });
    expect(result.current.error).toBeNull();
  });

  it('clearError resets the error state', async () => {
    const { result } = renderHook(() =>
      useOptimisticPatch<Row>({ initial: { quantity: 1, inStock: true } })
    );

    await act(async () => {
      await result.current.patch({
        optimistic: prev => ({ ...prev, quantity: 0 }),
        action: () => Promise.reject(new Error('nope')),
      });
    });

    expect(result.current.error).not.toBeNull();
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('supports a per-call errorMessage override', async () => {
    const { result } = renderHook(() =>
      useOptimisticPatch<Row>({ initial: { quantity: 1, inStock: true } })
    );

    await act(async () => {
      await result.current.patch({
        optimistic: prev => ({ ...prev, quantity: 0 }),
        action: () => Promise.reject(new Error('nope')),
        errorMessage: 'Custom rollback message',
      });
    });

    expect(result.current.error).toBe('Custom rollback message');
  });
});
