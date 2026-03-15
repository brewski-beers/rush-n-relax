import './ProductGridSkeleton.css';

export function ProductGridSkeleton() {
  return (
    <div className="product-grid-skeleton" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="product-grid-skeleton__card"
          style={{ '--delay': `${i * 0.1}s` } as React.CSSProperties}
        >
          <div className="product-grid-skeleton__image" />
          <div className="product-grid-skeleton__body">
            <div className="product-grid-skeleton__category" />
            <div className="product-grid-skeleton__title" />
            <div className="product-grid-skeleton__desc" />
            <div className="product-grid-skeleton__desc product-grid-skeleton__desc--short" />
          </div>
        </div>
      ))}
    </div>
  );
}
