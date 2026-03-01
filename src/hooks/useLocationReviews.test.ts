import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLocationReviews } from './useLocationReviews';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ __stub: true })),
  getDoc: vi.fn(),
}));

vi.mock('../firebase', () => ({
  getFirestore$: vi.fn(() => ({})),
}));

import { doc, getDoc } from 'firebase/firestore';

const mockDoc = vi.mocked(doc);
const mockGetDoc = vi.mocked(getDoc);

const mockReviewData = {
  placeId: 'ChIJG2IBn08zXIgROk6xAd9qyY0',
  rating: 4.7,
  totalRatings: 142,
  reviews: [
    {
      author_name: 'Alice Smith',
      rating: 5,
      text: 'Amazing dispensary!',
      relative_time_description: '2 weeks ago',
      profile_photo_url: '',
      time: 1700000000,
    },
  ],
  cachedAt: 1700000000000,
};

function makeSnap(exists: boolean, data?: object) {
  return { exists: () => exists, data: () => data } as ReturnType<
    typeof getDoc
  > extends Promise<infer S>
    ? S
    : never;
}

describe('useLocationReviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when placeId is undefined', () => {
    it('stays in idle status and returns empty data', () => {
      const { result } = renderHook(() => useLocationReviews(undefined));

      expect(result.current.status).toBe('idle');
      expect(result.current.rating).toBeNull();
      expect(result.current.totalRatings).toBeNull();
      expect(result.current.reviews).toEqual([]);
    });

    it('never calls getDoc', () => {
      renderHook(() => useLocationReviews(undefined));
      expect(mockGetDoc).not.toHaveBeenCalled();
    });
  });

  describe('when placeId is provided', () => {
    it('transitions through loading to success on a successful fetch', async () => {
      mockGetDoc.mockResolvedValue(makeSnap(true, mockReviewData));

      const { result } = renderHook(() =>
        useLocationReviews('ChIJG2IBn08zXIgROk6xAd9qyY0')
      );

      expect(result.current.status).toBe('loading');
      expect(result.current.rating).toBeNull();

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      expect(result.current.rating).toBe(4.7);
      expect(result.current.totalRatings).toBe(142);
      expect(result.current.reviews).toHaveLength(1);
      expect(result.current.reviews[0].author_name).toBe('Alice Smith');
    });

    it('transitions to error status when the document does not exist', async () => {
      mockGetDoc.mockResolvedValue(makeSnap(false));

      const { result } = renderHook(() =>
        useLocationReviews('ChIJG2IBn08zXIgROk6xAd9qyY0')
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      expect(result.current.rating).toBeNull();
      expect(result.current.totalRatings).toBeNull();
      expect(result.current.reviews).toEqual([]);
    });

    it('transitions to error status when the fetch fails', async () => {
      mockGetDoc.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useLocationReviews('ChIJG2IBn08zXIgROk6xAd9qyY0')
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      expect(result.current.rating).toBeNull();
    });

    it('reads from the location-reviews collection with the correct placeId', async () => {
      mockGetDoc.mockResolvedValue(makeSnap(true, mockReviewData));

      renderHook(() => useLocationReviews('ChIJG2IBn08zXIgROk6xAd9qyY0'));

      expect(mockDoc).toHaveBeenCalledWith(
        {},
        'location-reviews',
        'ChIJG2IBn08zXIgROk6xAd9qyY0'
      );

      await waitFor(() => expect(mockGetDoc).toHaveBeenCalled());
    });

    it('does not update state after unmount (cancellation)', async () => {
      let resolveSnap!: (snap: ReturnType<typeof makeSnap>) => void;
      mockGetDoc.mockReturnValue(
        new Promise(resolve => {
          resolveSnap = resolve;
        }) as ReturnType<typeof getDoc>
      );

      const { result, unmount } = renderHook(() =>
        useLocationReviews('ChIJG2IBn08zXIgROk6xAd9qyY0')
      );

      expect(result.current.status).toBe('loading');

      unmount();

      resolveSnap(makeSnap(true, mockReviewData));

      expect(result.current.status).toBe('loading');
    });

    it('resets to loading when placeId changes', async () => {
      mockGetDoc.mockResolvedValue(makeSnap(true, mockReviewData));

      const { result, rerender } = renderHook(
        ({ id }: { id: string }) => useLocationReviews(id),
        { initialProps: { id: 'ChIJG2IBn08zXIgROk6xAd9qyY0' } }
      );

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      rerender({ id: 'ChIJb1IipsQbXIgREaNxkmmAaHg' });

      expect(result.current.status).toBe('loading');

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });
    });
  });
});
