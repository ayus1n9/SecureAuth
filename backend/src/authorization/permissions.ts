import { Role } from '@prisma/client';

export type Permission =
  | 'profile:read:self'
  | 'profile:update:self'
  | 'records:create:self'
  | 'records:read:self'
  | 'records:update:self'
  | 'records:delete:self'
  | 'support:read'
  | 'users:read'
  | 'users:read_minimal'
  | 'users:update'
  | 'users:change_role'
  | 'admin:dashboard'
  | 'audit:read';

/**
 * Formal Role-Based Access Control (RBAC) Permission Matrix
 * Following the Principle of Least Privilege:
 * - USER: Can only inspect/modify their own profile and owned records.
 * - SUPPORT: Can inspect support queue and view non-sensitive user metadata; strictly barred from administrative actions.
 * - ADMIN: Has full management over user roles, administrative statistics, and audit logs.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  USER: [
    'profile:read:self',
    'profile:update:self',
    'records:create:self',
    'records:read:self',
    'records:update:self',
    'records:delete:self',
  ],
  SUPPORT: [
    'profile:read:self',
    'profile:update:self',
    'records:create:self',
    'records:read:self',
    'records:update:self',
    'records:delete:self',
    'support:read',
    'users:read_minimal',
  ],
  ADMIN: [
    'profile:read:self',
    'profile:update:self',
    'records:create:self',
    'records:read:self',
    'records:update:self',
    'records:delete:self',
    'support:read',
    'users:read',
    'users:read_minimal',
    'users:update',
    'users:change_role',
    'admin:dashboard',
    'audit:read',
  ],
};

/**
 * Evaluates whether a role possesses a specific permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) {
    return false;
  }
  return permissions.includes(permission);
}
