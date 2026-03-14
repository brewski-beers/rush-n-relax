export const MANAGEABLE_ROLES = [
  'storeOwner',
  'storeManager',
  'staff',
  'customer',
] as const;

export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

export function isManageableRole(value: unknown): value is ManageableRole {
  return (
    value === 'storeOwner' ||
    value === 'storeManager' ||
    value === 'staff' ||
    value === 'customer'
  );
}
