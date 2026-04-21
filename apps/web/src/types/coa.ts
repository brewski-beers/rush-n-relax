/**
 * Represents a Certificate of Analysis (COA) PDF stored in Firebase Storage.
 * Lives at: gs://rush-n-relax.firebasestorage.app/COA/{filename}
 */
export interface CoaDocument {
  /** Storage object name, e.g. "COA/Blue-Dream-2024-01.pdf" */
  name: string;
  /** Human-readable label derived from filename or custom metadata */
  label: string;
  /** Signed download URL (1-hour TTL) */
  downloadUrl: string;
  /** File size in bytes (from Storage metadata) */
  size: number;
  /** Last modified timestamp */
  updatedAt: Date;
}
