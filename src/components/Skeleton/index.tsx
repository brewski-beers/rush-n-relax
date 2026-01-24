import React from 'react';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Skeleton Component
 * 
 * Reusable loading skeleton with multiple variants.
 * Provides visual feedback during content loading.
 */
export function Skeleton({
  variant = 'rectangular',
  width = '100%',
  height = '20px',
  className = '',
  style: customStyle,
}: SkeletonProps) {
  const styles: React.CSSProperties = {
    width,
    height,
    borderRadius: variant === 'circular' ? '50%' : variant === 'text' ? '4px' : '8px',
    ...customStyle,
  };

  return <div className={`skeleton ${className}`} style={styles} />;
}

/**
 * Product Card Skeleton
 */
export function ProductCardSkeleton() {
  return (
    <div className="product-card">
      <Skeleton variant="rectangular" width="100%" height="200px" />
      <div style={{ padding: '1rem' }}>
        <Skeleton variant="text" width="70%" height="24px" />
        <Skeleton variant="text" width="40%" height="20px" style={{ marginTop: '0.5rem' }} />
        <Skeleton variant="rectangular" width="100%" height="40px" style={{ marginTop: '1rem' }} />
      </div>
    </div>
  );
}

/**
 * Product Detail Skeleton
 */
export function ProductDetailSkeleton() {
  return (
    <div className="product-detail-page">
      <Skeleton variant="text" width="200px" height="20px" />
      <div className="product-detail-grid" style={{ marginTop: '2rem' }}>
        <Skeleton variant="rectangular" width="100%" height="400px" />
        <div>
          <Skeleton variant="text" width="80%" height="32px" />
          <Skeleton variant="text" width="30%" height="24px" style={{ marginTop: '1rem' }} />
          <Skeleton variant="text" width="50%" height="28px" style={{ marginTop: '1rem' }} />
          <div style={{ marginTop: '2rem' }}>
            <Skeleton variant="text" width="100%" height="20px" />
            <Skeleton variant="text" width="100%" height="20px" style={{ marginTop: '0.5rem' }} />
            <Skeleton variant="text" width="80%" height="20px" style={{ marginTop: '0.5rem' }} />
          </div>
          <Skeleton variant="rectangular" width="100%" height="48px" style={{ marginTop: '2rem' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Category Grid Skeleton
 */
export function CategoryGridSkeleton() {
  return (
    <div className="category-grid">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="category-card">
          <Skeleton variant="rectangular" width="100%" height="250px" />
        </div>
      ))}
    </div>
  );
}
