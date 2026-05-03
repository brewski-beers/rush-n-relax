'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getStorageUrl } from '@/lib/storage/url-cache';
import './AmbientOverlay.css';

// Default Firebase Storage paths for ambient videos
const DEFAULT_AMBIENT_PATHS = {
  desktop: 'ambient/smoke-4k.mp4',
  mobile: 'ambient/smoke-1080p.mp4',
} as const;

// TODO(KB): drop a small first-frame JPEG at apps/web/public/ambient/smoke-poster.jpg.
// Browsers silently skip a missing poster, so adding the asset later requires
// no code change here.
const POSTER_SRC = '/ambient/smoke-poster.jpg';

// Lead time before `duration` at which we begin the crossfade to the
// other buffered <video>. Longer than the CSS transition (1200ms) so
// the swap is well underway before the outgoing clip hits its seam,
// making the handoff imperceptible.
const CROSSFADE_LEAD_SECONDS = 1.2;
const MOBILE_QUERY = '(max-width: 768px)';

export function AmbientOverlay() {
  // URLs are pure deterministic builds — no async, no SDK, no network.
  const desktopUrl = getStorageUrl(DEFAULT_AMBIENT_PATHS.desktop);
  const mobileUrl = getStorageUrl(DEFAULT_AMBIENT_PATHS.mobile);

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
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });
  const [activeIndex, setActiveIndex] = useState<0 | 1>(0);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isIntersecting, setIsIntersecting] = useState<boolean>(true);

  // Pane refs — right pane only used in desktop composition.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const leftARef = useRef<HTMLVideoElement | null>(null);
  const leftBRef = useRef<HTMLVideoElement | null>(null);
  const rightARef = useRef<HTMLVideoElement | null>(null);
  const rightBRef = useRef<HTMLVideoElement | null>(null);

  // prefers-reduced-motion (Approach D)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Mobile breakpoint (item 3) — switch composition on resize.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Document visibility (item 4a)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

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

  // IntersectionObserver on the stage (item 4b) — pause when fully off-screen.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      entries => {
        for (const entry of entries) setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0 }
    );
    obs.observe(stage);
    return () => obs.disconnect();
  }, [reducedMotion, enabled, isMobile]);

  // Pause / resume driver — collects all live videos and pauses when
  // off-screen or hidden; resumes the active buffer(s) when back.
  useEffect(() => {
    if (reducedMotion) return;
    const all = [
      leftARef.current,
      leftBRef.current,
      isMobile ? null : rightARef.current,
      isMobile ? null : rightBRef.current,
    ].filter((v): v is HTMLVideoElement => v !== null);

    const shouldPlay = isVisible && isIntersecting;
    if (!shouldPlay) {
      for (const v of all) {
        if (!v.paused) v.pause();
      }
      return;
    }
    // Resume only the currently active buffer(s); inactive stay paused
    // until the crossfade lead triggers them.
    const activeLeft = activeIndex === 0 ? leftARef.current : leftBRef.current;
    const activeRight = isMobile
      ? null
      : activeIndex === 0
        ? rightARef.current
        : rightBRef.current;
    for (const v of [activeLeft, activeRight]) {
      if (v && v.paused) {
        void v.play().catch(() => {
          /* autoplay may be blocked; ignore */
        });
      }
    }
  }, [isVisible, isIntersecting, activeIndex, isMobile, reducedMotion]);

  // Crossfade driver: as the active video approaches its end, start
  // the inactive buffer and swap. In desktop mode both panes mirror.
  useEffect(() => {
    if (reducedMotion) return;
    const lA = leftARef.current;
    const lB = leftBRef.current;
    if (!lA || !lB) return;
    const rA = isMobile ? null : rightARef.current;
    const rB = isMobile ? null : rightBRef.current;

    const handleTimeUpdate = (current: HTMLVideoElement) => {
      const isA = current === lA;
      if (!Number.isFinite(current.duration) || current.duration <= 0) return;
      const remaining = current.duration - current.currentTime;
      if (remaining > CROSSFADE_LEAD_SECONDS) return;
      const currentIsActive =
        (isA && activeIndex === 0) || (!isA && activeIndex === 1);
      if (!currentIsActive) return;

      const nextLeft = isA ? lB : lA;
      const nextRight = isA ? rB : rA;
      try {
        nextLeft.currentTime = 0;
        if (nextRight) nextRight.currentTime = 0;
        void nextLeft.play().catch(() => {
          /* autoplay may be blocked; ignore */
        });
        if (nextRight) {
          void nextRight.play().catch(() => {
            /* autoplay may be blocked; ignore */
          });
        }
      } catch {
        /* setting currentTime can throw if metadata not loaded */
      }
      setActiveIndex(prev => (prev === 0 ? 1 : 0));
    };

    const onTimeLA = () => handleTimeUpdate(lA);
    const onTimeLB = () => handleTimeUpdate(lB);
    lA.addEventListener('timeupdate', onTimeLA);
    lB.addEventListener('timeupdate', onTimeLB);
    return () => {
      lA.removeEventListener('timeupdate', onTimeLA);
      lB.removeEventListener('timeupdate', onTimeLB);
    };
  }, [activeIndex, reducedMotion, isMobile]);

  if (reducedMotion) return null;
  if (!enabled) return null;

  if (typeof document === 'undefined') return null;
  const portal = document.getElementById('ambient-portal');
  if (!portal) return null;

  const videoSrc = isMobile ? mobileUrl : desktopUrl;
  if (!videoSrc) return null;

  // Browsers fall back to inline placeholder if /ambient/smoke-poster.jpg
  // is missing, so the JSX uses the file path directly — adding the asset
  // later requires no code change.
  const poster = POSTER_SRC;

  const videoCommon = {
    muted: true,
    playsInline: true,
    crossOrigin: 'anonymous' as const,
    disablePictureInPicture: true,
    controls: false,
    poster,
    'aria-hidden': true as const,
  };

  const aPreload = activeIndex === 0 ? 'auto' : 'metadata';
  const bPreload = activeIndex === 1 ? 'auto' : 'metadata';
  const aClass = `ambient-video${activeIndex === 0 ? ' is-active' : ''}`;
  const bClass = `ambient-video${activeIndex === 1 ? ' is-active' : ''}`;

  return createPortal(
    <div ref={stageRef} className="ambient-stage" aria-hidden="true">
      <div className="ambient-pane">
        <video
          ref={leftARef}
          autoPlay
          preload={aPreload}
          {...videoCommon}
          className={aClass}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
        <video
          ref={leftBRef}
          preload={bPreload}
          {...videoCommon}
          className={bClass}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      </div>
      {!isMobile && (
        <div className="ambient-pane ambient-pane--mirrored">
          <video
            ref={rightARef}
            autoPlay
            preload={aPreload}
            {...videoCommon}
            className={aClass}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
          <video
            ref={rightBRef}
            preload={bPreload}
            {...videoCommon}
            className={bClass}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        </div>
      )}
    </div>,
    portal
  );
}
