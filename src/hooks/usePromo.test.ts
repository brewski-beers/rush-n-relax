import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePromo } from './usePromo';
import { getPromoBySlug } from '../constants/promos';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ __stub: true })),
  getDoc: vi.fn(),
}));

vi.mock('../firebase', () => ({
  getFirestore$: vi.fn(() => ({})),
  initializeApp: vi.fn(),
}));

import { doc, getDoc } from 'firebase/firestore';

const mockDoc = vi.mocked(doc);
const mockGetDoc = vi.mocked(getDoc);

const staticPromo = getPromoBySlug('laser-bong')!;

function makeSnap(exists: boolean, data?: object) {
  return { exists: () => exists, data: () => data } as ReturnType<
    typeof getDoc
  > extends Promise<infer S>
    ? S
    : never;
}

describe('usePromo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when slug is undefined', () => {
    it('returns null promo and idle status', () => {
      const { result } = renderHook(() => usePromo(undefined));
      expect(result.current.promo).toBeNull();
      expect(result.current.status).toBe('idle');
    });

    it('never calls getDoc', () => {
      renderHook(() => usePromo(undefined));
      expect(mockGetDoc).not.toHaveBeenCalled();
    });
  });

  describe('when slug is provided', () => {
    it('initialises with static fallback data before Firestore resolves', () => {
      mockGetDoc.mockReturnValue(
        new Promise(() => {}) as ReturnType<typeof getDoc>
      );

      const { result } = renderHook(() => usePromo('laser-bong'));

      // Static fallback is available immediately — page can render without waiting
      expect(result.current.promo?.slug).toBe('laser-bong');
      expect(result.current.status).toBe('loading');
    });

    it('updates to Firestore data on success', async () => {
      const firestorePromo = {
        ...staticPromo,
        tagline: 'Updated from Firestore',
      };
      mockGetDoc.mockResolvedValue(makeSnap(true, firestorePromo));

      const { result } = renderHook(() => usePromo('laser-bong'));

      await waitFor(() => expect(result.current.status).toBe('success'));

      expect(result.current.promo?.tagline).toBe('Updated from Firestore');
    });

    it('falls back to static data when document does not exist', async () => {
      mockGetDoc.mockResolvedValue(makeSnap(false));

      const { result } = renderHook(() => usePromo('laser-bong'));

      await waitFor(() => expect(result.current.status).toBe('error'));

      // Page still renders — static fallback is preserved
      expect(result.current.promo?.slug).toBe('laser-bong');
    });

    it('falls back to static data when document is inactive', async () => {
      mockGetDoc.mockResolvedValue(
        makeSnap(true, { ...staticPromo, active: false })
      );

      const { result } = renderHook(() => usePromo('laser-bong'));

      await waitFor(() => expect(result.current.status).toBe('error'));

      expect(result.current.promo?.slug).toBe('laser-bong');
    });

    it('falls back to static data when fetch throws', async () => {
      mockGetDoc.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePromo('laser-bong'));

      await waitFor(() => expect(result.current.status).toBe('error'));

      expect(result.current.promo?.slug).toBe('laser-bong');
    });

    it('returns null on error for an unknown slug (no static fallback)', async () => {
      mockGetDoc.mockResolvedValue(makeSnap(false));

      const { result } = renderHook(() => usePromo('not-a-real-slug'));

      await waitFor(() => expect(result.current.status).toBe('error'));

      expect(result.current.promo).toBeNull();
    });

    it('reads from the promos collection with the correct slug as document ID', async () => {
      mockGetDoc.mockResolvedValue(makeSnap(true, staticPromo));

      renderHook(() => usePromo('laser-bong'));

      expect(mockDoc).toHaveBeenCalledWith({}, 'promos', 'laser-bong');
      await waitFor(() => expect(mockGetDoc).toHaveBeenCalled());
    });

    it('does not update state after unmount (cancellation)', async () => {
      let resolveSnap!: (snap: ReturnType<typeof makeSnap>) => void;
      mockGetDoc.mockReturnValue(
        new Promise(resolve => {
          resolveSnap = resolve;
        }) as ReturnType<typeof getDoc>
      );

      const { result, unmount } = renderHook(() => usePromo('laser-bong'));

      expect(result.current.status).toBe('loading');
      unmount();
      resolveSnap(makeSnap(true, staticPromo));

      expect(result.current.status).toBe('loading');
    });
  });
});
