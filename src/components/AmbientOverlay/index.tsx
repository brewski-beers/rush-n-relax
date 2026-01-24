import { useEffect, useState } from 'react';
import { getStorage$, initializeApp } from '@/firebase';
import { getDownloadURL, ref, getStorage } from 'firebase/storage';

export function AmbientOverlay() {
  const directUrl = import.meta.env.VITE_AMBIENT_VIDEO_URL as string | undefined;
  const posterUrl = import.meta.env.VITE_AMBIENT_VIDEO_POSTER as string | undefined;
  const storagePath = import.meta.env.VITE_AMBIENT_STORAGE_PATH as string | undefined;
  const customBucket = import.meta.env.VITE_AMBIENT_STORAGE_BUCKET as string | undefined;
  const envEnabled = String(import.meta.env.VITE_AMBIENT_ENABLED ?? 'true').toLowerCase() !== 'false';

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
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

    async function resolveUrl() {
      try {
        if (storagePath) {
          const storage = customBucket ? getStorage(undefined, `gs://${customBucket}`) : getStorage$();
          const videoRef = ref(storage, storagePath);
          const url = await getDownloadURL(videoRef);
          if (!cancelled) setResolvedUrl(url);
          return;
        }
        if (directUrl) {
          setResolvedUrl(directUrl);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('AmbientOverlay: failed to resolve video URL', err);
        if (directUrl) setResolvedUrl(directUrl);
      }
    }

    resolveUrl();
    return () => { cancelled = true; };
  }, [directUrl, storagePath, customBucket]);

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

  if (!enabled || !resolvedUrl) return null;

  return (
    <div className="ambient-overlay" aria-hidden="true">
      <video
        className="ambient-video"
        src={resolvedUrl}
        poster={posterUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        disablePictureInPicture
        controls={false}
      />
    </div>
  );
}
