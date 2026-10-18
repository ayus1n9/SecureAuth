import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';

describe('Password Security Unit Tests (Argon2id)', () => {
  it('should hash a valid password with Argon2id format', async () => {
    const password = 'SuperSecretPassword123!@#';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    // Argon2id hash prefix verification
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('should generate unique salts for identical passwords', async () => {
    const password = 'IdenticalPassword123!@#';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });

  it('should accurately verify correct password against its hash', async () => {
    const password = 'CorrectPassword123!@#';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'CorrectPassword123!@#';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword('WrongPassword123!@#', hash);
    expect(isValid).toBe(false);
  });

  it('should handle empty or malformed inputs safely without crashing', async () => {
    expect(await verifyPassword('', '')).toBe(false);
    expect(await verifyPassword('password', 'invalid_hash_string')).toBe(false);
    await expect(hashPassword('')).rejects.toThrow();
  });
});
