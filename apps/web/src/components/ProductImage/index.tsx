'use client';

import { useState } from 'react';
import './ProductImage.css';

interface ProductImageProps {
  alt: string;
  className?: string;
  /**
   * Pre-resolved public image URL. When omitted (or empty), a placeholder
   * is rendered. URL resolution is the caller's responsibility — server
   * components should use `getStorageUrl(storagePath)` from
   * `@/lib/storage/url-cache` to construct the deterministic public URL
   * with zero network round-trip.
   */
  src?: string | null;
}

/**
 * Pure-display product image.
 *
 * Renders a placeholder until the browser successfully decodes the image.
 * Falls back to the placeholder on load error or when no `src` was provided.
 *
 * No Firebase SDK, no client-side getDownloadURL, no async resolution —
 * eliminates ~15KB from the client bundle and the 1–3s LCP delay caused
 * by mounting a Firebase storage client.
 */
export function ProductImage({ alt, className, src }: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const showPlaceholder = !src || failed;

  return (
    <div className={`product-card-img ${className ?? ''}`.trim()}>
      {showPlaceholder ? (
        <div className="product-image-placeholder" aria-hidden="true">
          <span className="product-image-icon">🌿</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`product-image ${loaded ? 'product-image-loaded' : ''}`}
          loading="eager"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
