import { Request, Response, NextFunction } from 'express';
import { validateSession, SESSION_COOKIE_NAME, SanitizedUser } from '../auth/session.js';
import { hasPermission, Permission } from '../authorization/permissions.js';
import { logAuditEvent } from '../logging/logger.js';

declare global {
  namespace Express {
    interface Request {
      user?: SanitizedUser;
      sessionId?: string;
    }
  }
}

/**
 * Authentication Middleware
 * Validates the stateful session cookie against the PostgreSQL session store.
 * Returns 401 Unauthorized if missing, malformed, or expired.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cookieSessionId = req.cookies?.[SESSION_COOKIE_NAME];
  const authHeader = req.headers.authorization;
  const headerSessionId = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;

  const sessionId = cookieSessionId || headerSessionId;

  if (!sessionId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid session required to access this resource',
    });
    return;
  }

  const user = await validateSession(sessionId);
  if (!user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Session has expired or is invalid',
    });
    return;
  }

  req.user = user;
  req.sessionId = sessionId;
  next();
}

/**
 * Role-Based Access Control (RBAC) Middleware
 * Verifies that the authenticated user possesses the required permission.
 * Logs an authorization failure audit event and returns 403 Forbidden on failure.
 */
export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required prior to authorization check',
      });
      return;
    }

    if (!hasPermission(req.user.role, permission)) {
      await logAuditEvent({
        eventType: 'AUTHORIZATION_DENIED',
        actorId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          attemptedPermission: permission,
          userRole: req.user.role,
          url: req.originalUrl,
          method: req.method,
        },
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to perform this action',
      });
      return;
    }

    next();
  };
}
