import { Router, Request, Response } from 'express';
import { prisma } from '../database/db.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import {
  createSession,
  rotateSession,
  destroySession,
  destroyAllUserSessions,
  setSessionCookie,
  clearSessionCookie,
  sanitizeUser,
} from '../auth/session.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../validation/schemas.js';
import { requireAuth } from '../middleware/auth.js';
import {
  authLimiter,
  registerLimiter,
  generateCsrfToken,
  CSRF_COOKIE_NAME,
} from '../middleware/security.js';
import { logAuditEvent } from '../logging/logger.js';

export const authRouter = Router();

/**
 * GET /api/v1/auth/csrf
 * Dispenses a fresh, HMAC-signed CSRF token.
 */
authRouter.get('/csrf', (req: Request, res: Response) => {
  const token = generateCsrfToken();
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Accessible to JavaScript for inclusion in X-CSRF-Token header
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({ csrfToken: token });
});

/**
 * POST /api/v1/auth/register
 * Secure public registration. Defaults strictly to least-privileged USER role.
 */
authRouter.post('/register', registerLimiter, async (req: Request, res: Response): Promise<void> => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const { email, password, fullName } = parseResult.data;

  // Check for existing account
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    await logAuditEvent({
      eventType: 'REGISTRATION_DUPLICATE_ATTEMPT',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { attemptedEmail: email },
    });

    // Consistent response prevents user enumeration
    res.status(409).json({
      error: 'Conflict',
      message: 'An account with this email address is already registered',
    });
    return;
  }

  const passwordHash = await hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash,
      role: 'USER', // Always hardcoded to least-privilege USER
    },
  });

  await logAuditEvent({
    eventType: 'USER_REGISTERED',
    actorId: newUser.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    details: { email: newUser.email, role: newUser.role },
  });

  res.status(201).json({
    message: 'Account successfully registered',
    user: sanitizeUser(newUser),
  });
});

/**
 * POST /api/v1/auth/login
 * Authenticates credentials, rotates session ID, sets secure cookie.
 */
authRouter.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const { email, password } = parseResult.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Timing attack mitigation: verify dummy hash if user doesn't exist
  let isPasswordValid = false;
  if (user) {
    isPasswordValid = await verifyPassword(password, user.passwordHash);
  } else {
    // Fake verify with constant-time characteristics
    await verifyPassword('dummy_password_for_constant_time', '$argon2id$v=19$m=65536,t=3,p=4$fake_salt$fake_hash');
  }

  if (!user || !isPasswordValid) {
    await logAuditEvent({
      eventType: 'LOGIN_FAILURE',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { attemptedEmail: email },
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid email or password',
    });
    return;
  }

  // Session rotation prevents session fixation
  const currentSessionId = req.cookies?.['secureauth_session'];
  const { sessionId, expiresAt } = await rotateSession(
    currentSessionId,
    user.id,
    req.ip,
    req.get('user-agent')
  );

  setSessionCookie(res, sessionId, expiresAt);

  // Generate a CSRF token for the authenticated session
  const csrfToken = generateCsrfToken();
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });

  await logAuditEvent({
    eventType: 'LOGIN_SUCCESS',
    actorId: user.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    details: { email: user.email, role: user.role },
  });

  res.json({
    message: 'Authentication successful',
    user: sanitizeUser(user),
    csrfToken,
  });
});

/**
 * POST /api/v1/auth/logout
 * Destroys session in database and clears cookies.
 */
authRouter.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (req.sessionId) {
    await destroySession(req.sessionId);
  }

  clearSessionCookie(res);

  await logAuditEvent({
    eventType: 'LOGOUT_SUCCESS',
    actorId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user's profile.
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

/**
 * PATCH /api/v1/auth/profile
 * Updates permitted profile fields (e.g. fullName) for the current user.
 */
authRouter.patch('/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parseResult = updateProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user!.id },
    data: parseResult.data,
  });

  await logAuditEvent({
    eventType: 'PROFILE_UPDATED',
    actorId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    details: parseResult.data,
  });

  res.json({
    message: 'Profile updated successfully',
    user: sanitizeUser(updatedUser),
  });
});

/**
 * POST /api/v1/auth/password
 * Changes password with current password verification, re-hashing, and session rotation.
 */
authRouter.post('/password', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parseResult = changePasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const { currentPassword, newPassword } = parseResult.data;

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: 'Not Found', message: 'User not found' });
    return;
  }

  const isValidCurrent = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValidCurrent) {
    await logAuditEvent({
      eventType: 'PASSWORD_CHANGE_FAILURE',
      actorId: req.user!.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { reason: 'Incorrect current password' },
    });

    res.status(400).json({
      error: 'Bad Request',
      message: 'Current password provided is incorrect',
    });
    return;
  }

  const newHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  // Security control: Invalidate all existing sessions and create a fresh one
  await destroyAllUserSessions(user.id);

  const { sessionId, expiresAt } = await createSession(user.id, req.ip, req.get('user-agent'));
  setSessionCookie(res, sessionId, expiresAt);

  await logAuditEvent({
    eventType: 'PASSWORD_CHANGED',
    actorId: user.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ message: 'Password changed successfully. All previous sessions invalidated.' });
});
