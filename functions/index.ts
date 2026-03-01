import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

const db = getFirestore();

const GOOGLE_PLACES_API_KEY = defineSecret('GOOGLE_PLACES_API_KEY');

const PLACES_API_BASE =
  'https://maps.googleapis.com/maps/api/place/details/json';
const FETCH_TIMEOUT_MS = 10_000;

const ALLOWED_PLACE_IDS = new Set([
  'ChIJG2IBn08zXIgROk6xAd9qyY0', // Oak Ridge
  'ChIJb1IipsQbXIgREaNxkmmAaHg', // Seymour
]);

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  relative_time_description: string;
  profile_photo_url: string;
  time: number;
}

interface PlacesApiResponse {
  status: string;
  error_message?: string;
  result?: {
    rating?: number;
    user_ratings_total?: number;
    reviews?: GoogleReview[];
  };
}

export async function fetchAndStoreReviews(
  placeId: string,
  apiKey: string
): Promise<void> {
  const url = new URL(PLACES_API_BASE);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'rating,user_ratings_total,reviews');
  url.searchParams.set('reviews_sort', 'most_relevant');
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Google Places API returned HTTP ${response.status}`);
  }

  const json = (await response.json()) as PlacesApiResponse;
  if (json.status !== 'OK' || !json.result) {
    throw new Error(
      `Places API status: ${json.status} — ${json.error_message ?? ''}`
    );
  }

  await db
    .collection('location-reviews')
    .doc(placeId)
    .set({
      placeId,
      rating: json.result.rating ?? 0,
      totalRatings: json.result.user_ratings_total ?? 0,
      reviews: (json.result.reviews ?? []).slice(0, 5),
      cachedAt: Date.now(),
    });

  logger.info('Reviews refreshed', { placeId });
}

export const refreshLocationReviews = onSchedule(
  { schedule: 'every 24 hours', secrets: [GOOGLE_PLACES_API_KEY] },
  async () => {
    const apiKey = GOOGLE_PLACES_API_KEY.value();
    if (!apiKey) {
      logger.error('GOOGLE_PLACES_API_KEY is not set — skipping refresh');
      return;
    }

    for (const placeId of ALLOWED_PLACE_IDS) {
      try {
        await fetchAndStoreReviews(placeId, apiKey);
      } catch (err) {
        logger.error('Failed to refresh reviews', { placeId, err });
      }
    }
  }
);
