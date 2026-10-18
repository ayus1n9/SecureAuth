import { Router, Request, Response } from 'express';
import { prisma } from '../database/db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  createRecordSchema,
  updateRecordSchema,
  uuidParamSchema,
  paginationQuerySchema,
} from '../validation/schemas.js';
import { logAuditEvent } from '../logging/logger.js';

export const recordsRouter = Router();

// All record endpoints require authentication
recordsRouter.use(requireAuth);

/**
 * GET /api/v1/records
 * Lists records belonging strictly to the authenticated user.
 */
recordsRouter.get('/', requirePermission('records:read:self'), async (req: Request, res: Response): Promise<void> => {
  const queryResult = paginationQuerySchema.safeParse(req.query);
  const { page = 1, limit = 20, search } = queryResult.success ? queryResult.data : { page: 1, limit: 20, search: undefined };

  const whereClause: any = { userId: req.user!.id };
  if (search) {
    whereClause.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [records, total] = await Promise.all([
    prisma.record.findMany({
      where: whereClause,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.record.count({ where: whereClause }),
  ]);

  res.json({
    data: records,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * POST /api/v1/records
 * Creates a record owned by the authenticated user.
 */
recordsRouter.post('/', requirePermission('records:create:self'), async (req: Request, res: Response): Promise<void> => {
  const parseResult = createRecordSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const { title, content, classification } = parseResult.data;

  const record = await prisma.record.create({
    data: {
      title,
      content,
      classification,
      userId: req.user!.id,
    },
  });

  await logAuditEvent({
    eventType: 'RECORD_CREATED',
    actorId: req.user!.id,
    targetId: record.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    details: { title: record.title, classification: record.classification },
  });

  res.status(201).json({
    message: 'Record created successfully',
    record,
  });
});

/**
 * GET /api/v1/records/:id
 * Server-side object ownership verification (BOLA / IDOR protection).
 */
recordsRouter.get('/:id', requirePermission('records:read:self'), async (req: Request, res: Response): Promise<void> => {
  const paramResult = uuidParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    res.status(400).json({ error: 'Validation Error', message: 'Invalid record ID format: must be a valid UUID' });
    return;
  }

  const { id } = paramResult.data;

  // Enforce ownership: query must match both record ID AND current user ID
  const record = await prisma.record.findFirst({
    where: {
      id,
      userId: req.user!.id,
    },
  });

  if (!record) {
    // Return 404 to avoid leaking whether the record exists under another user
    res.status(404).json({
      error: 'Not Found',
      message: 'Record not found or access denied',
    });
    return;
  }

  res.json({ record });
});

/**
 * PUT /api/v1/records/:id
 * Updates an owned record with server-enforced ownership checks.
 */
recordsRouter.put('/:id', requirePermission('records:update:self'), async (req: Request, res: Response): Promise<void> => {
  const paramResult = uuidParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    res.status(400).json({ error: 'Validation Error', message: 'Invalid record ID format: must be a valid UUID' });
    return;
  }

  const bodyResult = updateRecordSchema.safeParse(req.body);
  if (!bodyResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: bodyResult.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const { id } = paramResult.data;

  // Strict ownership check before updating
  const existing = await prisma.record.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!existing) {
    res.status(404).json({
      error: 'Not Found',
      message: 'Record not found or access denied',
    });
    return;
  }

  const updatedRecord = await prisma.record.update({
    where: { id },
    data: bodyResult.data,
  });

  await logAuditEvent({
    eventType: 'RECORD_UPDATED',
    actorId: req.user!.id,
    targetId: id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    details: { updatedFields: Object.keys(bodyResult.data) },
  });

  res.json({
    message: 'Record updated successfully',
    record: updatedRecord,
  });
});

/**
 * DELETE /api/v1/records/:id
 * Deletes an owned record with server-enforced ownership checks.
 */
recordsRouter.delete('/:id', requirePermission('records:delete:self'), async (req: Request, res: Response): Promise<void> => {
  const paramResult = uuidParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    res.status(400).json({ error: 'Validation Error', message: 'Invalid record ID format: must be a valid UUID' });
    return;
  }

  const { id } = paramResult.data;

  // Strict ownership check before deleting
  const existing = await prisma.record.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!existing) {
    res.status(404).json({
      error: 'Not Found',
      message: 'Record not found or access denied',
    });
    return;
  }

  await prisma.record.delete({ where: { id } });

  await logAuditEvent({
    eventType: 'RECORD_DELETED',
    actorId: req.user!.id,
    targetId: id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ message: 'Record deleted successfully' });
});
