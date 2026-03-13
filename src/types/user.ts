export type UserRole = 'owner' | 'manager' | 'staff' | 'superadmin';

/**
 * Firestore document shape for an authenticated user.
 * Lives at: users/{uid}
 * Global (not per-tenant) — tenantId scopes the user to a tenant.
 */
export interface User {
  email: string;
  displayName?: string;
  role: UserRole;
  /**
   * Location IDs this user can access.
   * For owner/manager: all locations.
   * For staff: only the locations listed here.
   */
  locationIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
