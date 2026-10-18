import pino from 'pino';
import { prisma } from '../database/db.js';

const sensitiveKeys = [
  'password',
  'passwordConfirm',
  'currentPassword',
  'newPassword',
  'token',
  'session',
  'sessionId',
  'cookie',
  'authorization',
  'csrfToken',
  'secret',
  'creditCard',
  'apiKey',
];

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      ...sensitiveKeys,
      ...sensitiveKeys.map((k) => `*.${k}`),
      ...sensitiveKeys.map((k) => `*.*.${k}`),
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-csrf-token"]',
    ],
    censor: '[REDACTED_SENSITIVE]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export interface AuditLogOptions {
  eventType: string;
  actorId?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}

/**
 * Persists high-value security events into the audit log database table
 * and writes structured JSON logs while strictly stripping any credentials.
 */
export async function logAuditEvent(options: AuditLogOptions): Promise<void> {
  const sanitizedDetails = options.details ? sanitizePayload(options.details) : undefined;

  logger.info({
    audit: true,
    eventType: options.eventType,
    actorId: options.actorId,
    targetId: options.targetId,
    ipAddress: options.ipAddress,
    details: sanitizedDetails,
  }, `Audit Event: ${options.eventType}`);

  try {
    await prisma.auditEvent.create({
      data: {
        eventType: options.eventType,
        actorId: options.actorId || null,
        targetId: options.targetId || null,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent ? options.userAgent.substring(0, 512) : null,
        details: sanitizedDetails as any,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to persist audit event to database');
  }
}

export function sanitizePayload<T>(input: T): T {
  if (!input || typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizePayload(item)) as unknown as T;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      output[key] = '[REDACTED_SENSITIVE]';
    } else if (typeof value === 'object' && value !== null) {
      output[key] = sanitizePayload(value);
    } else {
      output[key] = value;
    }
  }

  return output as T;
}
