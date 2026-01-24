/**
 * User & Authentication Types
 * Source of truth synced from Firebase Auth claims
 */

export type UserRole = 'admin' | 'manager' | 'staff' | 'customer' | 'guest';
export type EmployeeStatus = 'active' | 'inactive' | 'terminated';

/**
 * User Document (Firestore)
 * Minimal schema - auth claims are single source of truth
 * UID is PRIMARY KEY for all relationships
 */
export interface User {
  uid: string;                        // Firebase Auth UID (PRIMARY KEY)
  email: string;                      // Synced from auth
  displayName: string;                // Synced from auth
  role: UserRole;                     // Synced from claims
  
  // Employee-specific fields (null for non-staff)
  employeeId: string | null;          // Synced from claims
  employeeStatus: EmployeeStatus | null;  // Synced from claims
  transactionAuthority: boolean;      // Synced from claims
  
  // Metadata
  createdBy: string | null;           // UID who created this user (for guests)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Firebase Auth Custom Claims
 * Set via Cloud Functions
 */
export interface UserClaims {
  role: UserRole;
  employeeId?: string;
  employeeStatus?: EmployeeStatus;
  transactionAuthority?: boolean;
}

/**
 * Auth Context Type
 * Used by AuthContext provider
 */
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
}

/**
 * Permission system types
 */
export interface Permission {
  resource: 'products' | 'categories' | 'orders' | 'users' | 'carts' | 'payments';
  action: 'read' | 'create' | 'update' | 'delete';
  scope?: 'guest' | 'staff' | 'admin';
}

export const RolePermissions: Record<UserRole, Permission[]> = {
  guest: [
    { resource: 'products', action: 'read', scope: 'guest' },
    { resource: 'categories', action: 'read', scope: 'guest' },
  ],
  customer: [
    { resource: 'products', action: 'read', scope: 'guest' },
    { resource: 'categories', action: 'read', scope: 'guest' },
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'create' },
    { resource: 'carts', action: 'read' },
    { resource: 'carts', action: 'create' },
    { resource: 'carts', action: 'update' },
  ],
  staff: [
    { resource: 'products', action: 'read', scope: 'staff' },
    { resource: 'categories', action: 'read', scope: 'staff' },
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'create' },
    { resource: 'orders', action: 'update' },
    { resource: 'carts', action: 'read' },
    { resource: 'payments', action: 'read' },
    { resource: 'payments', action: 'create' },
  ],
  manager: [
    { resource: 'products', action: 'read', scope: 'admin' },
    { resource: 'products', action: 'create' },
    { resource: 'products', action: 'update' },
    { resource: 'categories', action: 'read', scope: 'admin' },
    { resource: 'categories', action: 'create' },
    { resource: 'categories', action: 'update' },
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'update' },
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'create' },
    { resource: 'users', action: 'update' },
    { resource: 'payments', action: 'read' },
  ],
  admin: [
    { resource: 'products', action: 'read', scope: 'admin' },
    { resource: 'products', action: 'create' },
    { resource: 'products', action: 'update' },
    { resource: 'products', action: 'delete' },
    { resource: 'categories', action: 'read', scope: 'admin' },
    { resource: 'categories', action: 'create' },
    { resource: 'categories', action: 'update' },
    { resource: 'categories', action: 'delete' },
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'update' },
    { resource: 'orders', action: 'delete' },
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'create' },
    { resource: 'users', action: 'update' },
    { resource: 'users', action: 'delete' },
    { resource: 'carts', action: 'read' },
    { resource: 'payments', action: 'read' },
    { resource: 'payments', action: 'update' },
  ],
};
