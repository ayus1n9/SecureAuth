import crypto from 'node:crypto';
import { Response } from 'express';
import { prisma } from '../database/db.js';
import { User, Role } from '@prisma/client';

export const SESSION_COOKIE_NAME = process.env.COOKIE_SECURE === 'true'
  ? '__Host-secureauth_session'
  : 'secureauth_session';

// 24 hours session lifetime
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface SanitizedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export function sanitizeUser(user: User): SanitizedUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Generates a cryptographically strong, 256-bit session identifier.
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates a new stateful session in the database.
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent ? userAgent.substring(0, 512) : null,
    },
  });

  return { sessionId, expiresAt };
}

/**
 * Validates an incoming session ID. If expired or not found, returns null.
 * Refreshes lastActiveAt for audit trail and idle timeout tracking.
 */
export async function validateSession(sessionId: string): Promise<SanitizedUser | null> {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length !== 64) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expiresAt.getTime() <= Date.now()) {
    // Delete expired session asynchronously
    prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  // Update last active timestamp
  prisma.session.update({
    where: { id: sessionId },
    data: { lastActiveAt: new Date() },
  }).catch(() => {});

  return sanitizeUser(session.user);
}

/**
 * Rotates an existing session by destroying the old token and generating a fresh one.
 * Mitigates session fixation attacks during login and privilege transitions.
 */
export async function rotateSession(
  oldSessionId: string | undefined,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ sessionId: string; expiresAt: Date }> {
  if (oldSessionId) {
    await prisma.session.deleteMany({
      where: { id: oldSessionId },
    }).catch(() => {});
  }

  return createSession(userId, ipAddress, userAgent);
}

/**
 * Destroys a single session upon logout.
 */
export async function destroySession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  await prisma.session.deleteMany({
    where: { id: sessionId },
  });
}

/**
 * Destroys all active sessions for a user (e.g. after a password change or security alert).
 */
export async function destroyAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * Sets an HttpOnly, SameSite, Secure (in production/HTTPS) cookie.
 */
export function setSessionCookie(res: Response, sessionId: string, expiresAt: Date): void {
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';

  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Clears the session cookie from the client's browser.
 */
export function clearSessionCookie(res: Response): void {
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
  });
}
