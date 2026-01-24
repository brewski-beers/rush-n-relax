import React, { useState, useEffect } from 'react';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  fallback?: string;
}

/**
 * OptimizedImage Component
 * 
 * Features:
 * - Lazy loading with intersection observer
 * - WebP format with fallback
 * - Blur-up effect while loading
 * - Responsive sizing
 * - Error handling with fallback
 */
export function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  fallback = 'https://placehold.co/400x300?text=Image+Not+Available',
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImageSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImageSrc(fallback);
    }
  };

  // Convert to WebP if browser supports it
  const getOptimizedSrc = (originalSrc: string) => {
    if (hasError) return originalSrc;
    
    // If it's an Unsplash URL, optimize it
    if (originalSrc.includes('unsplash.com')) {
      const url = new URL(originalSrc);
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('q', '80');
      return url.toString();
    }
    
    return originalSrc;
  };

  return (
    <LazyLoadImage
      src={getOptimizedSrc(imageSrc)}
      alt={alt}
      className={className}
      width={width}
      height={height}
      effect="blur"
      onError={handleError}
      threshold={100}
      placeholder={
        <div 
          className="skeleton" 
          style={{ width, height, minHeight: height || '200px' }}
        />
      }
    />
  );
}
