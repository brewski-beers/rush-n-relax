/**
 * Shared pagination types for repository list functions.
 */

/**
 * Paginated result from any list* repository function.
 * `nextCursor` is null when there are no further pages
 * (i.e. items.length < the requested limit).
 */
export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}
