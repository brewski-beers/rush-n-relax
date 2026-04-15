'use client';

import { useState, useEffect } from 'react';
import { getDownloadURL, ref } from 'firebase/storage';
import { initializeApp, getStorage$ } from '../../firebase';
import { resolveProductImageUrl } from '../../constants/products';
import './ProductImage.css';

interface ProductImageProps {
  slug: string;
  alt: string;
  className?: string;
  /**
   * Optional Firebase Storage path — resolves this path directly via
   * getDownloadURL instead of the slug-based extension-probing lookup.
   * Provide when the exact storage path is already known (e.g. after upload).
   */
  path?: string;
  /**
   * Optional pre-resolved public URL. When provided, skips all async
   * resolution and renders the image directly. Use when the URL is already
   * available (e.g. from Firestore product.image field).
   */
  src?: string;
}

async function resolvePathUrl(storagePath: string): Promise<string | null> {
  try {
    initializeApp();
    const storage = getStorage$();
    return await getDownloadURL(ref(storage, storagePath));
  } catch {
    return null;
  }
}

/**
 * Async-loads a product image from Firebase Storage.
 * If `path` is provided, resolves that storage path directly.
 * Otherwise falls back to the slug-based extension-probing lookup.
 * Shows a shimmer placeholder while loading, and a fallback if unavailable.
 */
export function ProductImage({
  slug,
  alt,
  className,
  path,
  src: srcProp,
}: ProductImageProps) {
  const [src, setSrc] = useState<string | null>(srcProp ?? null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // If a direct URL was provided, state is already initialized — skip resolution.
    if (srcProp) return;

    let cancelled = false;

    const resolve = path
      ? () => resolvePathUrl(path)
      : () => resolveProductImageUrl(slug);

    void resolve()
      .then(url => {
        if (!cancelled) {
          if (url) setSrc(url);
          else setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, path, srcProp]);

  const content =
    failed || (!src && !loaded) ? (
      <div className="product-image-placeholder" aria-hidden="true">
        <span className="product-image-icon">🌿</span>
      </div>
    ) : (
      <img
        src={src!} // src is non-null here: we only render this branch after setSrc(url)
        alt={alt}
        className={`product-image ${loaded ? 'product-image-loaded' : ''}`}
        loading="eager"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    );

  return (
    <div className={`product-card-img ${className ?? ''}`.trim()}>
      {content}
    </div>
  );
}
