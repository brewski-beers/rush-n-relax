import { useReducer, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirestore$ } from '../firebase';
import type { GoogleReview } from '../types/reviews';

type ReviewsStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseLocationReviewsResult {
  rating: number | null;
  totalRatings: number | null;
  reviews: GoogleReview[];
  status: ReviewsStatus;
}

type ReviewsState = UseLocationReviewsResult;

type ReviewsAction =
  | { type: 'loading' }
  | {
      type: 'success';
      rating: number;
      totalRatings: number;
      reviews: GoogleReview[];
    }
  | { type: 'error' };

function reviewsReducer(
  state: ReviewsState,
  action: ReviewsAction
): ReviewsState {
  switch (action.type) {
    case 'loading':
      return {
        status: 'loading',
        rating: null,
        totalRatings: null,
        reviews: [],
      };
    case 'success':
      return {
        status: 'success',
        rating: action.rating,
        totalRatings: action.totalRatings,
        reviews: action.reviews,
      };
    case 'error':
      return { ...state, status: 'error' };
  }
}

const initialState: ReviewsState = {
  status: 'idle',
  rating: null,
  totalRatings: null,
  reviews: [],
};

export function useLocationReviews(
  placeId: string | undefined
): UseLocationReviewsResult {
  const [state, dispatch] = useReducer(reviewsReducer, initialState);

  useEffect(() => {
    if (!placeId) return;

    let cancelled = false;
    dispatch({ type: 'loading' });

    getDoc(doc(getFirestore$(), 'location-reviews', placeId))
      .then(snap => {
        if (cancelled) return;
        if (!snap.exists()) throw new Error('No reviews available');
        const data = snap.data();
        dispatch({
          type: 'success',
          rating: data.rating as number,
          totalRatings: data.totalRatings as number,
          reviews: data.reviews as GoogleReview[],
        });
      })
      .catch(() => {
        if (cancelled) return;
        dispatch({ type: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  return state;
}
