import * as argon2 from 'argon2';

/**
 * OWASP-compliant Argon2id password hashing parameters.
 * Type: argon2id (2)
 * Memory cost: 64 MB (65536 KiB) (19 MB in test mode for rapid automated testing)
 * Time cost (iterations): 3 (2 in test mode)
 * Parallelism: 2
 */
const isTestEnv = process.env.NODE_ENV === 'test';

const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: isTestEnv ? 19456 : 65536,
  timeCost: isTestEnv ? 2 : 3,
  parallelism: 2,
};

/**
 * Hashes a plaintext password using Argon2id with secure random salt.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Invalid password provided for hashing');
  }
  return argon2.hash(password, { ...ARGON2_OPTIONS, raw: false });
}

/**
 * Verifies a plaintext candidate password against a stored Argon2id hash.
 * Constant-time comparison is inherently enforced by argon2.verify.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
