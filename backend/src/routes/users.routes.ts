import { Router, Request, Response } from 'express';
import { prisma } from '../database/db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { uuidParamSchema, changeRoleSchema, paginationQuerySchema } from '../validation/schemas.js';
import { destroyAllUserSessions, sanitizeUser } from '../auth/session.js';
import { logAuditEvent } from '../logging/logger.js';

export const usersRouter = Router();

// All user management routes require authentication
usersRouter.use(requireAuth);

/**
 * GET /api/v1/users
 * Returns users based on caller role:
 * - ADMIN: full administrative profile
 * - SUPPORT: minimal non-sensitive profile
 */
usersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const isSupport = req.user!.role === 'SUPPORT';
  const isAdmin = req.user!.role === 'ADMIN';

  if (!isSupport && !isAdmin) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient permissions to view user directory',
    });
    return;
  }

  const queryResult = paginationQuerySchema.safeParse(req.query);
  const { page = 1, limit = 20, search } = queryResult.success ? queryResult.data : { page: 1, limit: 20, search: undefined };

  const whereClause: any = {};
  if (search) {
    whereClause.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: isAdmin
        ? {
            id: true,
            email: true,
            fullName: true,
            role: true,
            failedLoginAttempts: true,
            lockoutUntil: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { sessions: true, records: true } },
          }
        : {
            id: true,
            email: true,
            fullName: true,
            role: true,
            createdAt: true,
          },
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  res.json({
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /api/v1/users/:id
 * Fetches user profile by ID with RBAC-scoped data filtering.
 */
usersRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const isSupport = req.user!.role === 'SUPPORT';
  const isAdmin = req.user!.role === 'ADMIN';

  if (!isSupport && !isAdmin) {
    res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
    return;
  }

  const paramResult = uuidParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    res.status(400).json({ error: 'Validation Error', message: 'Invalid user ID format' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: paramResult.data.id },
    select: isAdmin
      ? {
          id: true,
          email: true,
          fullName: true,
          role: true,
          failedLoginAttempts: true,
          lockoutUntil: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { sessions: true, records: true } },
        }
      : {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
        },
  });

  if (!user) {
    res.status(404).json({ error: 'Not Found', message: 'User not found' });
    return;
  }

  res.json({ user });
});

/**
 * PATCH /api/v1/users/:id/role
 * Privileged operation: Only ADMIN with `users:change_role` can modify roles.
 * Self-modification is prohibited to prevent accidental administrator lockout.
 */
usersRouter.patch('/:id/role', requirePermission('users:change_role'), async (req: Request, res: Response): Promise<void> => {
  const paramResult = uuidParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    res.status(400).json({ error: 'Validation Error', message: 'Invalid user ID format' });
    return;
  }

  const bodyResult = changeRoleSchema.safeParse(req.body);
  if (!bodyResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: bodyResult.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const { id } = paramResult.data;
  const { role: newRole } = bodyResult.data;

  // Prevent admin from modifying their own role
  if (req.user!.id === id) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Administrators cannot alter their own role to prevent system lockout',
    });
    return;
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    res.status(404).json({ error: 'Not Found', message: 'Target user not found' });
    return;
  }

  const oldRole = targetUser.role;

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { role: newRole },
  });

  // Security control: Invalidate all active sessions of target user so privilege change takes immediate effect
  await destroyAllUserSessions(id);

  await logAuditEvent({
    eventType: 'USER_ROLE_CHANGED',
    actorId: req.user!.id,
    targetId: id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    details: { oldRole, newRole, targetEmail: targetUser.email },
  });

  res.json({
    message: `User role successfully updated from ${oldRole} to ${newRole}`,
    user: sanitizeUser(updatedUser),
  });
});
