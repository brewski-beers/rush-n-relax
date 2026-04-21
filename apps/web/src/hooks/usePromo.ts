import { useReducer, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { initializeApp, getFirestore$ } from '../firebase';
import type { Promo } from '@/types';

/**
 * Firestore collection: `promos`
 * Document ID: promo slug (e.g. "laser-bong")
 *
 * Expected document shape — must match the Promo interface:
 * {
 *   slug:        string   (document ID)
 *   name:        string
 *   tagline:     string
 *   description: string
 *   details:     string
 *   cta:         string
 *   ctaPath:     string
 *   image?:      string   (Firebase Storage path)
 *   active:      boolean
 * }
 *
 * Runtime policy is Firestore-first and Firestore-only.
 * Missing or inactive documents resolve to null/error rather than reading
 * from local content constants.
 */

type PromoStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UsePromoResult {
  promo: Promo | null;
  status: PromoStatus;
}

type PromoState = UsePromoResult;

type PromoAction =
  | { type: 'loading' }
  | { type: 'success'; promo: Promo }
  | { type: 'error' };

function promoReducer(state: PromoState, action: PromoAction): PromoState {
  switch (action.type) {
    case 'loading':
      return { ...state, status: 'loading' };
    case 'success':
      return { promo: action.promo, status: 'success' };
    case 'error':
      return { promo: null, status: 'error' };
  }
}

export function usePromo(slug: string | undefined): UsePromoResult {
  const [state, dispatch] = useReducer(promoReducer, {
    promo: null,
    status: 'idle',
  });

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    dispatch({ type: 'loading' });

    try {
      initializeApp();
      getDoc(doc(getFirestore$(), 'promos', slug))
        .then(snap => {
          if (cancelled) return;
          if (!snap.exists() || snap.data().active === false) {
            dispatch({ type: 'error' });
            return;
          }
          // Safe cast: Firestore document was seeded from the Promo type and
          // is only written by seed scripts or future admin routes that enforce
          // the same shape.
          dispatch({ type: 'success', promo: snap.data() as Promo });
        })
        .catch(() => {
          if (cancelled) return;
          dispatch({ type: 'error' });
        });
    } catch {
      dispatch({ type: 'error' });
    }

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state;
}
