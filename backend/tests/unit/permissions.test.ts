import { describe, it, expect } from 'vitest';
import { hasPermission, ROLE_PERMISSIONS } from '../../src/authorization/permissions.js';

describe('RBAC Permission Matrix Unit Tests', () => {
  it('USER should possess self-resource permissions only', () => {
    expect(hasPermission('USER', 'profile:read:self')).toBe(true);
    expect(hasPermission('USER', 'records:create:self')).toBe(true);
    expect(hasPermission('USER', 'records:read:self')).toBe(true);
    expect(hasPermission('USER', 'records:update:self')).toBe(true);
    expect(hasPermission('USER', 'records:delete:self')).toBe(true);

    // Forbidden permissions
    expect(hasPermission('USER', 'support:read')).toBe(false);
    expect(hasPermission('USER', 'users:read')).toBe(false);
    expect(hasPermission('USER', 'users:change_role')).toBe(false);
    expect(hasPermission('USER', 'admin:dashboard')).toBe(false);
    expect(hasPermission('USER', 'audit:read')).toBe(false);
  });

  it('SUPPORT should have access to support queue and minimal user data, but NOT admin controls', () => {
    expect(hasPermission('SUPPORT', 'support:read')).toBe(true);
    expect(hasPermission('SUPPORT', 'users:read_minimal')).toBe(true);

    // Administrative boundaries must hold
    expect(hasPermission('SUPPORT', 'users:read')).toBe(false);
    expect(hasPermission('SUPPORT', 'users:change_role')).toBe(false);
    expect(hasPermission('SUPPORT', 'admin:dashboard')).toBe(false);
    expect(hasPermission('SUPPORT', 'audit:read')).toBe(false);
  });

  it('ADMIN should possess all system and management permissions', () => {
    expect(hasPermission('ADMIN', 'admin:dashboard')).toBe(true);
    expect(hasPermission('ADMIN', 'users:change_role')).toBe(true);
    expect(hasPermission('ADMIN', 'users:read')).toBe(true);
    expect(hasPermission('ADMIN', 'audit:read')).toBe(true);
  });
});
