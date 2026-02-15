import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getStorage$, initializeApp } from '@/firebase';
import { getDownloadURL, ref, getStorage } from 'firebase/storage';

interface ResolvedUrls {
  desktop: string | null;
  mobile: string | null;
}

export function AmbientOverlay() {
  const directUrl = import.meta.env.VITE_AMBIENT_VIDEO_URL as string | undefined;
  const posterUrl = import.meta.env.VITE_AMBIENT_VIDEO_POSTER as string | undefined;
  const storagePath = import.meta.env.VITE_AMBIENT_STORAGE_PATH as string | undefined;
  const mobileStoragePath = import.meta.env.VITE_AMBIENT_MOBILE_PATH as string | undefined;
  const customBucket = import.meta.env.VITE_AMBIENT_STORAGE_BUCKET as string | undefined;
  const envEnabled = String(import.meta.env.VITE_AMBIENT_ENABLED ?? 'true').toLowerCase() !== 'false';

  const [resolvedUrls, setResolvedUrls] = useState<ResolvedUrls>({
    desktop: null,
    mobile: null,
  });
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const ls = localStorage.getItem('ambientEnabled');
      return ls === null ? envEnabled : ls === 'true';
    } catch {
      return envEnabled;
    }
  });

  useEffect(() => {
    initializeApp();

    let cancelled = false;

    async function resolveUrls() {
      try {
        const urls: ResolvedUrls = { desktop: null, mobile: null };

        // Resolve desktop (4K) video
        if (storagePath) {
          try {
            const storage = customBucket ? getStorage(undefined, `gs://${customBucket}`) : getStorage$();
            const videoRef = ref(storage, storagePath);
            const url = await getDownloadURL(videoRef);
            if (!cancelled) urls.desktop = url;
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('AmbientOverlay: failed to resolve desktop video URL', err);
            if (directUrl) urls.desktop = directUrl;
          }
        } else if (directUrl) {
          urls.desktop = directUrl;
        }

        // Resolve mobile (1080p) video
        if (mobileStoragePath) {
          try {
            const storage = customBucket ? getStorage(undefined, `gs://${customBucket}`) : getStorage$();
            const videoRef = ref(storage, mobileStoragePath);
            const url = await getDownloadURL(videoRef);
            if (!cancelled) urls.mobile = url;
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('AmbientOverlay: failed to resolve mobile video URL', err);
            // Fall back to desktop if mobile fails
            urls.mobile = urls.desktop;
          }
        } else {
          // Fall back to desktop if no mobile path
          urls.mobile = urls.desktop;
        }

        if (!cancelled) setResolvedUrls(urls);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('AmbientOverlay: critical error resolving URLs', err);
      }
    }

    resolveUrls();
    return () => { cancelled = true; };
  }, [directUrl, storagePath, mobileStoragePath, customBucket]);

  // Listen for preference changes dispatched by UI (custom event) or storage updates
  useEffect(() => {
    const updateFromStorage = () => {
      try {
        const ls = localStorage.getItem('ambientEnabled');
        setEnabled(ls === null ? envEnabled : ls === 'true');
      } catch {
        setEnabled(envEnabled);
      }
    };
    const customHandler = () => updateFromStorage();
    window.addEventListener('ambient:toggle', customHandler);
    const storageHandler = (e: StorageEvent) => { if (e.key === 'ambientEnabled') updateFromStorage(); };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('ambient:toggle', customHandler);
      window.removeEventListener('storage', storageHandler);
    };
  }, [envEnabled]);

  if (!enabled || (!resolvedUrls.desktop && !resolvedUrls.mobile)) return null;

  const portal = document.getElementById('ambient-portal');
  if (!portal) return null;

  return createPortal(
    <video
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      crossOrigin="anonymous"
      disablePictureInPicture
      controls={false}
      poster={posterUrl}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {resolvedUrls.mobile && (
        <source src={resolvedUrls.mobile} media="(max-width: 768px)" type="video/mp4" />
      )}
      {resolvedUrls.desktop && (
        <source src={resolvedUrls.desktop} type="video/mp4" />
      )}
    </video>,
    portal
  );
}
