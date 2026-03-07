import { useReducer, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { initializeApp, getFirestore$ } from '../firebase';
import { getPromoBySlug, type Promo } from '../constants/promos';

/**
 * Firestore collection: `promos`
 * Document ID: promo slug (e.g. "laser-bong")
 *
 * Expected document shape — must match the Promo interface:
 * {
 *   promoId:     string   (stable ID, e.g. "hitoki-laser-bong-2025")
 *   slug:        string
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
 * When the collection doesn't exist yet (or a document is missing),
 * the hook falls back to the static seed data in src/constants/promos.ts
 * so the page continues to render without the backend being live.
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
  | { type: 'error'; fallback: Promo | null };

function promoReducer(state: PromoState, action: PromoAction): PromoState {
  switch (action.type) {
    case 'loading':
      return { ...state, status: 'loading' };
    case 'success':
      return { promo: action.promo, status: 'success' };
    case 'error':
      // Keep whatever promo we have (static fallback) so the page still renders
      return { promo: action.fallback, status: 'error' };
  }
}

export function usePromo(slug: string | undefined): UsePromoResult {
  const staticFallback = slug ? (getPromoBySlug(slug) ?? null) : null;

  const [state, dispatch] = useReducer(promoReducer, {
    promo: staticFallback,
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
            // Document not in Firestore yet — use static seed data silently
            dispatch({ type: 'error', fallback: staticFallback });
            return;
          }
          dispatch({ type: 'success', promo: snap.data() as Promo });
        })
        .catch(() => {
          if (cancelled) return;
          dispatch({ type: 'error', fallback: staticFallback });
        });
    } catch {
      // Firebase not initialized (e.g. test env) — fall back to static
      dispatch({ type: 'error', fallback: staticFallback });
    }

    return () => {
      cancelled = true;
    };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
