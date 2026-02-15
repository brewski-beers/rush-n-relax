import { useState, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  title?: string;
  width?: number;
  height?: number;
  className?: string;
  lazy?: boolean;
  responsive?: boolean;
  srcSet?: string;
  sizes?: string;
}

/**
 * OptimizedImage Component
 * Handles responsive images, lazy loading, and WebP format support
 */
export function OptimizedImage({
  src,
  alt,
  title,
  width,
  height,
  className = '',
  lazy = true,
  responsive = true,
  srcSet,
  sizes,
}: OptimizedImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleLoad = () => {
    setImageLoaded(true);
  };

  // Determine file extension
  const getWebPSrc = (imageSrc: string): string => {
    if (imageSrc.includes('://')) {
      // External URL - don't convert
      return imageSrc;
    }
    return imageSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  };

  const webpSrc = getWebPSrc(src);
  const isExternalUrl = src.includes('://');

  return (
    <picture>
      {!isExternalUrl && <source srcSet={webpSrc} type="image/webp" />}
      <source srcSet={srcSet} sizes={sizes} key="source" />
      <img
        src={src}
        alt={alt}
        title={title}
        width={width}
        height={height}
        className={`optimized-image ${className} ${imageLoaded ? 'loaded' : ''}`}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        onLoad={handleLoad}
      />
    </picture>
  );
}
