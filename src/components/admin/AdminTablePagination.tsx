import Link from 'next/link';

interface AdminTablePaginationProps {
  /** Base path for pagination links (e.g. "/admin/products") */
  baseHref: string;
  /** Cursor of the previous page, undefined on page 1 */
  prevCursor: string | undefined;
  /** Cursor for the next page, null when this is the last page */
  nextCursor: string | null;
  /** Cursor stack to pass as prevCursors on the prev page URL */
  prevCursorsStack: string[];
  /** Cursor stack to pass as prevCursors on the next page URL */
  nextCursorsStack: string[];
}

/**
 * Prev/Next pagination controls for admin table pages.
 * Both controls are URL-based — rendered as links for accessibility.
 * Hidden when there is only one page (no prevCursor and no nextCursor).
 */
export function AdminTablePagination({
  baseHref,
  prevCursor,
  nextCursor,
  prevCursorsStack,
  nextCursorsStack,
}: AdminTablePaginationProps) {
  const hasPrev = prevCursor !== undefined;
  const hasNext = nextCursor !== null;

  if (!hasPrev && !hasNext) return null;

  function buildUrl(cursor: string | undefined, stack: string[]): string {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (stack.length > 0) params.set('prevCursors', stack.join(','));
    const qs = params.toString();
    return qs ? `${baseHref}?${qs}` : baseHref;
  }

  const prevUrl = buildUrl(prevCursor, prevCursorsStack);
  const nextUrl = buildUrl(nextCursor ?? undefined, nextCursorsStack);

  return (
    <nav className="admin-table-pagination" aria-label="Table pagination">
      {hasPrev ? (
        <Link href={prevUrl} className="admin-btn-secondary">
          &larr; Previous
        </Link>
      ) : (
        <span className="admin-btn-secondary admin-btn-disabled" aria-disabled="true">
          &larr; Previous
        </span>
      )}
      {hasNext ? (
        <Link href={nextUrl} className="admin-btn-secondary">
          Next &rarr;
        </Link>
      ) : (
        <span className="admin-btn-secondary admin-btn-disabled" aria-disabled="true">
          Next &rarr;
        </span>
      )}
    </nav>
  );
}
