/**
 * Role-based access control configuration
 * Defines role hierarchy, permissions, and metadata
 */
import type { UserRole } from '@/types';

export interface RoleConfig {
  label: string;
  description: string;
  color: string;
  canSee: UserRole[]; // Roles this role can view/access
  canModify: UserRole[]; // Roles this role can modify/update
}

export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  admin: {
    label: 'Admin',
    description: 'Full system access, owns the business',
    color: '#a78bfa', // purple
    canSee: ['admin', 'manager', 'staff', 'customer', 'guest'],
    canModify: ['admin', 'manager', 'staff', 'customer', 'guest'],
  },
  manager: {
    label: 'Manager',
    description: 'Second in command, manage staff and customers',
    color: '#fb923c', // orange
    canSee: ['manager', 'staff', 'customer'],
    canModify: ['staff', 'customer'],
  },
  staff: {
    label: 'Staff',
    description: 'Serve customers, process orders',
    color: '#22c55e', // green
    canSee: ['customer'],
    canModify: ['customer'],
  },
  customer: {
    label: 'Customer',
    description: 'Shop and place orders',
    color: '#3b82f6', // blue
    canSee: [],
    canModify: [],
  },
  guest: {
    label: 'Guest',
    description: 'Anonymous visitor; limited browsing',
    color: '#6b7280', // gray
    canSee: [],
    canModify: [],
  },
};

/**
 * Get displayable role label
 */
export function getRoleLabel(role: UserRole): string {
  return ROLE_CONFIG[role]?.label || role;
}

/**
 * Get role color for UI
 */
export function getRoleColor(role: UserRole): string {
  return ROLE_CONFIG[role]?.color || '#6b7280';
}

/**
 * Check if a role can see another role
 */
export function canSeeRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_CONFIG[actorRole]?.canSee.includes(targetRole) ?? false;
}

/**
 * Check if a role can modify another role
 */
export function canModifyRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_CONFIG[actorRole]?.canModify.includes(targetRole) ?? false;
}

/**
 * Check if an actor can update a target user's display name
 * Customers and staff/manager/admin can update display names
 * Customers can only update their own
 */
export function canUpdateDisplayName(actorRole: UserRole, targetUserId: string, actorUserId: string, targetRole: UserRole): boolean {
  // Only staff-level and above + customers can update display names
  if (!['staff', 'manager', 'admin', 'customer'].includes(actorRole)) {
    return false;
  }

  // Customers can only update their own
  if (actorRole === 'customer') {
    return actorUserId === targetUserId;
  }

  // Staff can update customers
  if (actorRole === 'staff') {
    return ['customer'].includes(targetRole);
  }

  // Manager can update staff and customers
  if (actorRole === 'manager') {
    return ['staff', 'customer'].includes(targetRole);
  }

  // Admin can update anyone
  if (actorRole === 'admin') {
    return true;
  }

  return false;
}
