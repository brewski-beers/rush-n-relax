/**
 * Common utility types used across the app
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Firestore Timestamp utility
 */
export type FirestoreTimestamp = Timestamp;

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Query result with loading/error state
 */
export interface QueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Mutation result
 */
export interface MutationResult<T> {
  mutate: (data: T) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
}

/**
 * Form validation error
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Generic ID type
 */
export type ID = string;

/**
 * Firestore document with ID
 */
export interface WithId<T> {
  id: ID;
  data: T;
}
