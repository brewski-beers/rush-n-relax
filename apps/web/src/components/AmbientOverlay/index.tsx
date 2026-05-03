'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getStorage$, initializeApp } from '@/firebase';
import { getDownloadURL, ref } from 'firebase/storage';
import './AmbientOverlay.css';

interface ResolvedUrls {
  desktop: string | null;
  mobile: string | null;
}

// Default Firebase Storage paths for ambient videos
const DEFAULT_AMBIENT_PATHS = {
  desktop: 'ambient/smoke-4k.mp4',
  mobile: 'ambient/smoke-1080p.mp4',
} as const;

// Lead time before `duration` at which we begin the crossfade to the
// other buffered <video>. Longer than the CSS transition (1200ms) so
// the swap is well underway before the outgoing clip hits its seam,
// making the handoff imperceptible.
const CROSSFADE_LEAD_SECONDS = 1.2;

export function AmbientOverlay() {
  const storagePath = DEFAULT_AMBIENT_PATHS.desktop;
  const mobileStoragePath = DEFAULT_AMBIENT_PATHS.mobile;

  const [resolvedUrls, setResolvedUrls] = useState<ResolvedUrls>({
    desktop: null,
    mobile: null,
  });
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const ls = localStorage.getItem('ambientEnabled');
      return ls === null ? true : ls === 'true';
    } catch {
      return true;
    }
  });
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [activeIndex, setActiveIndex] = useState<0 | 1>(0);

  // Two panes (left + mirrored right), each with a double-buffered pair.
  // The mirror pane is driven by the same activeIndex / play state so the
  // composition stays symmetrical.
  const leftARef = useRef<HTMLVideoElement | null>(null);
  const leftBRef = useRef<HTMLVideoElement | null>(null);
  const rightARef = useRef<HTMLVideoElement | null>(null);
  const rightBRef = useRef<HTMLVideoElement | null>(null);

  // Track prefers-reduced-motion. When enabled, we render nothing —
  // the storefront already has a static styled background, so the
  // calmest UX is no motion at all (Approach D in the design handoff).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    initializeApp();

    let cancelled = false;

    async function resolveUrls() {
      try {
        const urls: ResolvedUrls = { desktop: null, mobile: null };
        const storage = getStorage$();

        try {
          const videoRef = ref(storage, storagePath);
          const url = await getDownloadURL(videoRef);
          if (!cancelled) urls.desktop = url;
        } catch (err) {
          console.warn(
            'AmbientOverlay: failed to resolve desktop video URL',
            err
          );
        }

        try {
          const videoRef = ref(storage, mobileStoragePath);
          const url = await getDownloadURL(videoRef);
          if (!cancelled) urls.mobile = url;
        } catch (err) {
          console.warn(
            'AmbientOverlay: failed to resolve mobile video URL',
            err
          );
          urls.mobile = urls.desktop;
        }

        if (!cancelled) setResolvedUrls(urls);
      } catch (err) {
        console.error('AmbientOverlay: critical error resolving URLs', err);
      }
    }

    void resolveUrls();
    return () => {
      cancelled = true;
    };
  }, [storagePath, mobileStoragePath]);

  // Listen for preference changes dispatched by UI (custom event) or storage updates
  useEffect(() => {
    const updateFromStorage = () => {
      try {
        const ls = localStorage.getItem('ambientEnabled');
        setEnabled(ls === null ? true : ls === 'true');
      } catch {
        setEnabled(true);
      }
    };
    const customHandler = () => updateFromStorage();
    window.addEventListener('ambient:toggle', customHandler);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'ambientEnabled') updateFromStorage();
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('ambient:toggle', customHandler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  // Crossfade driver: as the active left video approaches its end, start
  // the inactive buffer (on both panes) and swap which is visible. Both
  // panes use the same source URL so the file is fetched once and cached.
  // The left pane drives timing; the right pane mirrors it via the shared
  // activeIndex and synchronized play() calls.
  useEffect(() => {
    if (reducedMotion) return;
    const lA = leftARef.current;
    const lB = leftBRef.current;
    const rA = rightARef.current;
    const rB = rightBRef.current;
    if (!lA || !lB || !rA || !rB) return;

    const handleTimeUpdate = (current: HTMLVideoElement) => {
      const isA = current === lA;
      if (!Number.isFinite(current.duration) || current.duration <= 0) return;
      const remaining = current.duration - current.currentTime;
      if (remaining > CROSSFADE_LEAD_SECONDS) return;
      // Avoid re-triggering once the swap has begun
      const currentIsActive =
        (isA && activeIndex === 0) || (!isA && activeIndex === 1);
      if (!currentIsActive) return;

      // Start the inactive buffer on BOTH panes simultaneously.
      const nextLeft = isA ? lB : lA;
      const nextRight = isA ? rB : rA;
      try {
        nextLeft.currentTime = 0;
        nextRight.currentTime = 0;
        void nextLeft.play().catch(() => {
          /* autoplay may be blocked; ignore */
        });
        void nextRight.play().catch(() => {
          /* autoplay may be blocked; ignore */
        });
      } catch {
        /* setting currentTime can throw if metadata not loaded */
      }
      setActiveIndex(prev => (prev === 0 ? 1 : 0));
    };

    // Drive timing off the left pane only; right mirrors via state.
    const onTimeLA = () => handleTimeUpdate(lA);
    const onTimeLB = () => handleTimeUpdate(lB);
    lA.addEventListener('timeupdate', onTimeLA);
    lB.addEventListener('timeupdate', onTimeLB);
    return () => {
      lA.removeEventListener('timeupdate', onTimeLA);
      lB.removeEventListener('timeupdate', onTimeLB);
    };
  }, [activeIndex, reducedMotion, resolvedUrls.desktop, resolvedUrls.mobile]);

  if (reducedMotion) return null;
  if (!enabled || (!resolvedUrls.desktop && !resolvedUrls.mobile)) return null;

  if (typeof document === 'undefined') return null;
  const portal = document.getElementById('ambient-portal');
  if (!portal) return null;

  // Pick video URL in JS — <source media=""> is ignored by browsers inside <video>
  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 768px)').matches;
  const videoSrc =
    (isMobile ? resolvedUrls.mobile : resolvedUrls.desktop) ??
    resolvedUrls.desktop ??
    resolvedUrls.mobile;

  if (!videoSrc) return null;

  const videoCommon = {
    muted: true,
    playsInline: true,
    preload: 'auto' as const,
    crossOrigin: 'anonymous' as const,
    disablePictureInPicture: true,
    controls: false,
    'aria-hidden': true as const,
  };

  return createPortal(
    <div className="ambient-stage" aria-hidden="true">
      <div className="ambient-pane">
        <video
          ref={leftARef}
          autoPlay
          {...videoCommon}
          className={`ambient-video${activeIndex === 0 ? ' is-active' : ''}`}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
        <video
          ref={leftBRef}
          {...videoCommon}
          className={`ambient-video${activeIndex === 1 ? ' is-active' : ''}`}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      </div>
      <div className="ambient-pane ambient-pane--mirrored">
        <video
          ref={rightARef}
          autoPlay
          {...videoCommon}
          className={`ambient-video${activeIndex === 0 ? ' is-active' : ''}`}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
        <video
          ref={rightBRef}
          {...videoCommon}
          className={`ambient-video${activeIndex === 1 ? ' is-active' : ''}`}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      </div>
    </div>,
    portal
  );
}
