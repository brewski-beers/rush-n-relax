'use client';

import { useState, useOptimistic, useTransition, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { getDownloadURL, ref } from 'firebase/storage';
import { initializeApp, getStorage$ } from '../../../firebase';
import { FeaturedSlot } from './FeaturedSlot';
import { GalleryStrip } from './GalleryStrip';
import './ProductImageUpload.css';

/**
 * Resolves a Firebase Storage path to a download URL for display.
 * - null input → returns null
 * - blob: URLs (optimistic previews) → returned as-is, no async needed
 * - Storage paths → resolved async via getDownloadURL; returns previous
 *   resolved URL while the new one loads (avoids flash of empty slot)
 */
function useResolvedSrc(pathOrObjectUrl: string | null): string | null {
  // Only used for async storage-path resolution; blob/null cases bypass state.
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    // blob: and null are handled synchronously in the return below — skip effect.
    if (!pathOrObjectUrl || pathOrObjectUrl.startsWith('blob:')) return;

    let cancelled = false;
    initializeApp();
    void getDownloadURL(ref(getStorage$(), pathOrObjectUrl))
      .then(url => {
        if (!cancelled) setResolved(url);
      })
      .catch(err => {
        console.error(
          '[ProductImageUpload] Failed to resolve download URL:',
          pathOrObjectUrl,
          err
        );
        if (!cancelled) setResolved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathOrObjectUrl]);

  if (!pathOrObjectUrl) return null;
  if (pathOrObjectUrl.startsWith('blob:')) return pathOrObjectUrl;
  return resolved;
}

interface Props {
  slug: string;
  initialFeaturedPath?: string;
  initialGalleryPaths?: string[];
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const GALLERY_SIZE = 5;

function buildGallery(paths?: string[]): (string | null)[] {
  const base = Array<string | null>(GALLERY_SIZE).fill(null);
  if (paths) {
    paths.slice(0, GALLERY_SIZE).forEach((p, i) => {
      base[i] = p;
    });
  }
  return base;
}

// ── Inner component that can call useFormStatus ────────────────────────────

interface InnerProps extends Props {
  featuredPath: string | null;
  setFeaturedPath: (p: string | null) => void;
  galleryPaths: (string | null)[];
  setGalleryPaths: (
    updater: (prev: (string | null)[]) => (string | null)[]
  ) => void;
}

function ProductImageUploadInner({
  slug,
  featuredPath,
  setFeaturedPath,
  galleryPaths,
  setGalleryPaths,
}: InnerProps) {
  const { pending: formPending } = useFormStatus();

  // Optimistic preview sources (object URLs while upload is in flight)
  const [optimisticFeatured, setOptimisticFeatured] = useOptimistic<
    string | null
  >(featuredPath);
  const [optimisticGallery, setOptimisticGallery] =
    useOptimistic<(string | null)[]>(galleryPaths);

  // Resolve storage paths → download URLs for display.
  // Object URLs (blob:) are returned as-is; storage paths are resolved via getDownloadURL.
  const displayFeatured = useResolvedSrc(optimisticFeatured);
  const displayGallery0 = useResolvedSrc(optimisticGallery[0] ?? null);
  const displayGallery1 = useResolvedSrc(optimisticGallery[1] ?? null);
  const displayGallery2 = useResolvedSrc(optimisticGallery[2] ?? null);
  const displayGallery3 = useResolvedSrc(optimisticGallery[3] ?? null);
  const displayGallery4 = useResolvedSrc(optimisticGallery[4] ?? null);
  const displayGallery = [
    displayGallery0,
    displayGallery1,
    displayGallery2,
    displayGallery3,
    displayGallery4,
  ];

  // Per-slot upload state
  const [isUploadingFeatured, startFeaturedUpload] = useTransition();
  const [uploadingGallerySlots, setUploadingGallerySlots] = useState<
    Set<number>
  >(new Set());

  const [errors, setErrors] = useState<Record<string | number, string>>({});

  function clearError(slot: 'featured' | number) {
    setErrors(prev => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }

  function setError(slot: 'featured' | number, msg: string) {
    setErrors(prev => ({ ...prev, [slot]: msg }));
  }

  // ── Upload ───────────────────────────────────────────────────────────────

  function handleFile(file: File, slot: 'featured' | number) {
    clearError(slot);

    if (!ALLOWED_TYPES.has(file.type)) {
      setError(slot, 'Only JPEG, PNG, or WebP allowed.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(slot, 'Max file size is 5 MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    if (slot === 'featured') {
      startFeaturedUpload(async () => {
        setOptimisticFeatured(objectUrl);

        const fd = new FormData();
        fd.append('file', file);
        fd.append('slug', slug);
        fd.append('slot', 'featured');

        const res = await fetch('/api/admin/products/upload-image', {
          method: 'POST',
          body: fd,
        });

        URL.revokeObjectURL(objectUrl);

        if (!res.ok) {
          setError('featured', 'Upload failed. Try again.');
          return;
        }

        const { path } = (await res.json()) as { path: string };
        setFeaturedPath(path);
      });
    } else {
      // slot is a number here — the 'featured' branch is exhausted above
      const slotIndex = slot;

      setUploadingGallerySlots(prev => new Set([...prev, slotIndex]));
      setOptimisticGallery(prev =>
        prev.map((p, i) => (i === slotIndex ? objectUrl : p))
      );

      void (async () => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('slug', slug);
        fd.append('slot', String(slotIndex));

        const res = await fetch('/api/admin/products/upload-image', {
          method: 'POST',
          body: fd,
        });

        URL.revokeObjectURL(objectUrl);
        setUploadingGallerySlots(prev => {
          const next = new Set(prev);
          next.delete(slotIndex);
          return next;
        });

        if (!res.ok) {
          setError(slotIndex, 'Upload failed. Try again.');
          return;
        }

        const { path } = (await res.json()) as { path: string };
        setGalleryPaths(prev =>
          prev.map((p, i) => (i === slotIndex ? path : p))
        );
      })();
    }
  }

  // ── Remove ───────────────────────────────────────────────────────────────

  // Synchronous: fire-and-forget fetch, then update local state immediately.
  function handleRemove(slot: 'featured' | number) {
    const path = slot === 'featured' ? featuredPath : galleryPaths[slot];
    if (!path) return;

    // Fire-and-forget: UI updates immediately; server cleans up async
    void fetch('/api/admin/products/delete-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    if (slot === 'featured') {
      setFeaturedPath(null);
    } else {
      const slotIndex = slot;
      setGalleryPaths(prev => prev.map((p, i) => (i === slotIndex ? null : p)));
    }
  }

  // ── Gallery reorder ───────────────────────────────────────────────────────

  function handleReorder(newPaths: (string | null)[]) {
    setGalleryPaths(() => newPaths);
  }

  return (
    <>
      {/* Featured image */}
      <div className="img-upload-featured-section">
        <p className="admin-label">Featured Image</p>
        <FeaturedSlot
          src={displayFeatured}
          uploading={isUploadingFeatured}
          error={
            typeof errors['featured'] === 'string'
              ? errors['featured']
              : undefined
          }
          disabled={formPending}
          onFile={file => handleFile(file, 'featured')}
          onRemove={() => handleRemove('featured')}
        />
      </div>

      {/* Gallery strip */}
      <div>
        <p className="admin-label">Gallery Images</p>
        <span className="admin-hint">Drag to reorder. Up to 5 images.</span>
        <GalleryStrip
          srcs={displayGallery}
          paths={galleryPaths}
          uploadingSlots={uploadingGallerySlots}
          errors={
            // Narrow Record<string|number, string> down to Record<number, string>
            // by dropping the 'featured' string key — gallery errors are numeric only.
            Object.fromEntries(
              Object.entries(errors)
                .filter(([k]) => k !== 'featured')
                .map(([k, v]) => [Number(k), v])
            ) as Record<number, string>
          }
          disabled={formPending}
          onFile={(file, index) => handleFile(file, index)}
          onRemove={index => handleRemove(index)}
          onReorder={handleReorder}
        />
      </div>

      {/* Hidden inputs — read by the Server Action on submit */}
      <input
        type="hidden"
        name="featuredImagePath"
        value={featuredPath ?? ''}
      />
      {galleryPaths.map((p, i) => (
        <input
          key={i}
          type="hidden"
          name={`galleryImagePath_${i}`}
          value={p ?? ''}
        />
      ))}
    </>
  );
}

// ── Public component ───────────────────────────────────────────────────────

/**
 * Admin image upload widget for product featured + gallery images.
 *
 * Must be rendered inside a <form> so that useFormStatus() works correctly.
 *
 * React 19 hooks used:
 *   - useOptimistic: shows object URL previews while uploads are in flight
 *   - useTransition: wraps featured upload fetch (non-blocking, drives spinner)
 *   - useFormStatus: disables buttons while parent form is submitting
 */
export function ProductImageUpload({
  slug,
  initialFeaturedPath,
  initialGalleryPaths,
}: Props) {
  const [featuredPath, setFeaturedPath] = useState<string | null>(
    initialFeaturedPath ?? null
  );
  const [galleryPaths, setGalleryPaths] = useState<(string | null)[]>(
    buildGallery(initialGalleryPaths)
  );

  return (
    <ProductImageUploadInner
      slug={slug}
      initialFeaturedPath={initialFeaturedPath}
      initialGalleryPaths={initialGalleryPaths}
      featuredPath={featuredPath}
      setFeaturedPath={setFeaturedPath}
      galleryPaths={galleryPaths}
      setGalleryPaths={setGalleryPaths}
    />
  );
}
