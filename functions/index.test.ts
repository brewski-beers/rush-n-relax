import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock state (available in vi.mock factories) ──────────────────

const {
  mockSet,
  mockDocRef,
  mockCollection,
  mockApiKeyRef,
  scheduledHandlerRef,
} = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockDocRef = vi.fn(() => ({ set: mockSet }));
  const mockCollection = vi.fn(() => ({ doc: mockDocRef }));
  // Object references so tests can mutate values between runs
  const mockApiKeyRef = { value: 'test-api-key' };
  const scheduledHandlerRef: { fn: (() => Promise<void>) | null } = {
    fn: null,
  };
  return {
    mockSet,
    mockDocRef,
    mockCollection,
    mockApiKeyRef,
    scheduledHandlerRef,
  };
});

// ─── Module mocks ─────────────────────────────────────────────────────────

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: vi.fn((_config: unknown, handler: () => Promise<void>) => {
    scheduledHandlerRef.fn = handler;
    return {};
  }),
}));

vi.mock('firebase-functions/params', () => ({
  defineSecret: vi.fn(() => ({ value: () => mockApiKeyRef.value })),
}));

vi.mock('firebase-functions/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({ collection: mockCollection })),
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import { fetchAndStoreReviews } from './index';
import { logger } from 'firebase-functions/logger';

const mockLogger = vi.mocked(logger);

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeFetchResponse(status: string, result?: object, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 503,
    json: () => Promise.resolve({ status, result }),
  } as Response);
}

const stubReview = {
  author_name: 'Test User',
  rating: 5,
  text: 'Great place!',
  relative_time_description: '1 week ago',
  profile_photo_url: '',
  time: 1700000000,
};

const okResult = {
  rating: 4.8,
  user_ratings_total: 312,
  reviews: [stubReview],
};

// ─── fetchAndStoreReviews ──────────────────────────────────────────────────

describe('fetchAndStoreReviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
    mockApiKeyRef.value = 'test-api-key';
  });

  it('writes correct data to Firestore on a successful API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse('OK', okResult))
    );

    await fetchAndStoreReviews('place-123', 'api-key');

    expect(mockCollection).toHaveBeenCalledWith('location-reviews');
    expect(mockDocRef).toHaveBeenCalledWith('place-123');
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        placeId: 'place-123',
        rating: 4.8,
        totalRatings: 312,
        reviews: [stubReview],
      })
    );
  });

  it('writes a cachedAt timestamp', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse('OK', okResult))
    );
    const before = Date.now();

    await fetchAndStoreReviews('place-123', 'api-key');

    const written = mockSet.mock.calls[0][0] as { cachedAt: number };
    expect(written.cachedAt).toBeGreaterThanOrEqual(before);
    expect(written.cachedAt).toBeLessThanOrEqual(Date.now());
  });

  it('slices reviews to a maximum of 5', async () => {
    const manyReviews = Array.from({ length: 8 }, (_, i) => ({
      ...stubReview,
      author_name: `User ${i}`,
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        makeFetchResponse('OK', { ...okResult, reviews: manyReviews })
      )
    );

    await fetchAndStoreReviews('place-123', 'api-key');

    const written = mockSet.mock.calls[0][0] as { reviews: unknown[] };
    expect(written.reviews).toHaveLength(5);
  });

  it('defaults rating to 0 when missing from API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        makeFetchResponse('OK', { user_ratings_total: 10, reviews: [] })
      )
    );

    await fetchAndStoreReviews('place-123', 'api-key');

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 0 })
    );
  });

  it('defaults totalRatings to 0 when missing from API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse('OK', { rating: 4.5, reviews: [] }))
    );

    await fetchAndStoreReviews('place-123', 'api-key');

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ totalRatings: 0 })
    );
  });

  it('defaults reviews to empty array when missing from API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        makeFetchResponse('OK', { rating: 4.5, user_ratings_total: 10 })
      )
    );

    await fetchAndStoreReviews('place-123', 'api-key');

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ reviews: [] })
    );
  });

  it('throws when the HTTP response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse('', undefined, false))
    );

    await expect(fetchAndStoreReviews('place-123', 'api-key')).rejects.toThrow(
      'HTTP 503'
    );
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('throws when Places API returns a non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse('ZERO_RESULTS', undefined))
    );

    await expect(fetchAndStoreReviews('place-123', 'api-key')).rejects.toThrow(
      'ZERO_RESULTS'
    );
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('throws when Places API returns no result object', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse('OK', undefined))
    );

    await expect(
      fetchAndStoreReviews('place-123', 'api-key')
    ).rejects.toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('propagates network errors from fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Network failure')))
    );

    await expect(fetchAndStoreReviews('place-123', 'api-key')).rejects.toThrow(
      'Network failure'
    );
  });

  it('builds the Places API URL with the correct place_id and key', async () => {
    const mockFetch = vi.fn(() => makeFetchResponse('OK', okResult));
    vi.stubGlobal('fetch', mockFetch);

    await fetchAndStoreReviews('ChIJG2IBn08zXIgROk6xAd9qyY0', 'my-key');

    const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get('place_id')).toBe(
      'ChIJG2IBn08zXIgROk6xAd9qyY0'
    );
    expect(calledUrl.searchParams.get('key')).toBe('my-key');
    expect(calledUrl.searchParams.get('fields')).toContain('rating');
  });
});

// ─── refreshLocationReviews handler ───────────────────────────────────────

describe('refreshLocationReviews scheduled handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
    mockApiKeyRef.value = 'test-api-key';
  });

  it('is registered with the scheduler on module load', () => {
    expect(scheduledHandlerRef.fn).not.toBeNull();
  });

  it('logs an error and skips all fetches when API key is empty', async () => {
    mockApiKeyRef.value = '';
    vi.stubGlobal('fetch', vi.fn());

    await scheduledHandlerRef.fn!();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('GOOGLE_PLACES_API_KEY')
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches data for all known place IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse('OK', okResult))
    );

    await scheduledHandlerRef.fn!();

    // ALLOWED_PLACE_IDS has 2 entries (Oak Ridge + Seymour)
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(
      2
    );
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it('continues processing remaining locations when one fails', async () => {
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('API down'));
        return makeFetchResponse('OK', okResult);
      })
    );

    await scheduledHandlerRef.fn!();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to refresh reviews',
      expect.objectContaining({ err: expect.any(Error) })
    );
    // Second location still processed successfully
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it('logs info for each successfully refreshed location', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse('OK', okResult))
    );

    await scheduledHandlerRef.fn!();

    expect(mockLogger.info).toHaveBeenCalledTimes(2);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Reviews refreshed',
      expect.objectContaining({ placeId: expect.any(String) })
    );
  });
});
