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
  const [state, dispatch] = useReducer(promoReducer, {
    promo: slug ? (getPromoBySlug(slug) ?? null) : null,
    status: 'idle',
  });

  useEffect(() => {
    if (!slug) return;

    // Compute fallback inside the effect so it's captured in the same closure
    // as slug — no need to suppress exhaustive-deps for an outer binding.
    const staticFallback = getPromoBySlug(slug) ?? null;
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
          // Safe cast: Firestore document was seeded from the Promo type and
          // is only written by seed scripts or future admin routes that enforce
          // the same shape.
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
  }, [slug]);

  return state;
}
