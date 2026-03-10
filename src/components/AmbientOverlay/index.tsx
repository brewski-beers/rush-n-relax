'use client';

import { useEffect, useState } from 'react';
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

export function AmbientOverlay() {
  const storagePath = DEFAULT_AMBIENT_PATHS.desktop;
  const mobileStoragePath = DEFAULT_AMBIENT_PATHS.mobile;

  // User preference from localStorage (defaults to enabled)
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

  useEffect(() => {
    initializeApp();

    let cancelled = false;

    async function resolveUrls() {
      try {
        const urls: ResolvedUrls = { desktop: null, mobile: null };
        const storage = getStorage$();

        // Resolve desktop (4K) video
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

        // Resolve mobile (1080p) video
        try {
          const videoRef = ref(storage, mobileStoragePath);
          const url = await getDownloadURL(videoRef);
          if (!cancelled) urls.mobile = url;
        } catch (err) {
          console.warn(
            'AmbientOverlay: failed to resolve mobile video URL',
            err
          );
          // Fall back to desktop if mobile fails
          urls.mobile = urls.desktop;
        }

        if (!cancelled) setResolvedUrls(urls);
      } catch (err) {
        console.error('AmbientOverlay: critical error resolving URLs', err);
      }
    }

    resolveUrls();
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

  if (!enabled || (!resolvedUrls.desktop && !resolvedUrls.mobile)) return null;

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

  return createPortal(
    <video
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      crossOrigin="anonymous"
      disablePictureInPicture
      controls={false}
      className="ambient-video"
    >
      {videoSrc && <source src={videoSrc} type="video/mp4" />}
    </video>,
    portal
  );
}
