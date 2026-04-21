import Link from 'next/link';
import './Pagination.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  category: string | null;
}

function buildPageHref(page: number, category: string | null): string {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/products?${qs}` : '/products';
}

export function Pagination({
  currentPage,
  totalPages,
  category,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Product page navigation">
      {currentPage > 1 ? (
        <Link
          href={buildPageHref(currentPage - 1, category)}
          className="pagination__item"
        >
          ← Prev
        </Link>
      ) : (
        <span className="pagination__item pagination__item--disabled">
          ← Prev
        </span>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p =>
        p === currentPage ? (
          <span
            key={p}
            className="pagination__item pagination__item--active"
            aria-current="page"
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={buildPageHref(p, category)}
            className="pagination__item"
          >
            {p}
          </Link>
        )
      )}
      {currentPage < totalPages ? (
        <Link
          href={buildPageHref(currentPage + 1, category)}
          className="pagination__item"
        >
          Next →
        </Link>
      ) : (
        <span className="pagination__item pagination__item--disabled">
          Next →
        </span>
      )}
    </nav>
  );
}
