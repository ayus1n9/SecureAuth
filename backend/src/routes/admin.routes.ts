import { Router, Request, Response } from 'express';
import { prisma } from '../database/db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { paginationQuerySchema } from '../validation/schemas.js';

export const adminRouter = Router();

// All administrative routes require authentication
adminRouter.use(requireAuth);

/**
 * GET /api/v1/admin/stats
 * Administrative metrics and system overview.
 */
adminRouter.get('/stats', requirePermission('admin:dashboard'), async (req: Request, res: Response): Promise<void> => {
  const [
    totalUsers,
    usersByRole,
    activeSessions,
    totalRecords,
    recentAudits,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    }),
    prisma.session.count({
      where: { expiresAt: { gt: new Date() } },
    }),
    prisma.record.count(),
    prisma.auditEvent.count(),
  ]);

  const roleCounts = usersByRole.reduce((acc, curr) => {
    acc[curr.role] = curr._count._all;
    return acc;
  }, {} as Record<string, number>);

  res.json({
    metrics: {
      totalUsers,
      roleDistribution: {
        USER: roleCounts['USER'] || 0,
        SUPPORT: roleCounts['SUPPORT'] || 0,
        ADMIN: roleCounts['ADMIN'] || 0,
      },
      activeSessions,
      totalRecords,
      totalAuditEvents: recentAudits,
      systemStatus: 'HEALTHY',
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/v1/admin/audit-logs
 * Security Audit Event viewer.
 */
adminRouter.get('/audit-logs', requirePermission('audit:read'), async (req: Request, res: Response): Promise<void> => {
  const queryResult = paginationQuerySchema.safeParse(req.query);
  const { page = 1, limit = 20, search } = queryResult.success ? queryResult.data : { page: 1, limit: 20, search: undefined };

  const whereClause: any = {};
  if (search) {
    whereClause.OR = [
      { eventType: { contains: search, mode: 'insensitive' } },
      { ipAddress: { contains: search } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where: whereClause,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { timestamp: 'desc' },
    }),
    prisma.auditEvent.count({ where: whereClause }),
  ]);

  res.json({
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
