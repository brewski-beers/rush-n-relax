import { useState, useEffect } from 'react';
import { resolveProductImageUrl } from '../../constants/products';

interface ProductImageProps {
  slug: string;
  alt: string;
  className?: string;
}

/**
 * Async-loads a product image from Firebase Storage.
 * Shows a shimmer placeholder while loading, and a category-tinted
 * fallback if the image is unavailable.
 */
export function ProductImage({ slug, alt, className = '' }: ProductImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveProductImageUrl(slug).then((url) => {
      if (!cancelled) {
        if (url) setSrc(url);
        else setFailed(true);
      }
    });
    return () => { cancelled = true; };
  }, [slug]);

  const content = failed || (!src && !loaded) ? (
    <div
      className="product-image-placeholder"
      aria-hidden="true"
    >
      <span className="product-image-icon">🌿</span>
    </div>
  ) : (
    <img
      src={src!}
      alt={alt}
      className={`product-image ${loaded ? 'product-image-loaded' : ''}`}
      loading="eager"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      style={{ maxHeight: '200px', maxWidth: '160px' }}
    />
  );

  return (
    <div className="product-card-img">
      {content}
    </div>
  );
}
