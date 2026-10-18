import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { logger, logAuditEvent } from '../logging/logger.js';

const CSRF_SECRET = process.env.CSRF_SECRET || 'dev_csrf_secret_32_bytes_entropy_required';
export const CSRF_COOKIE_NAME = 'secureauth_csrf_token';

/**
 * Generates an HMAC-signed CSRF token.
 */
export function generateCsrfToken(): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const hmac = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');
  return `${nonce}.${hmac}`;
}

/**
 * Validates an HMAC-signed CSRF token.
 */
export function verifyCsrfToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [nonce, providedHmac] = parts;
  const expectedHmac = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(providedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'));
  } catch {
    return false;
  }
}

/**
 * CSRF Protection Middleware
 * Enforces signed double-submit CSRF token on all state-changing HTTP methods
 * (POST, PUT, PATCH, DELETE).
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe HTTP methods do not mutate state and are exempted
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Exempt public registration and login from CSRF token verification if initial session is unestablished,
  // while still enforcing strict rate limiting and credentials validation.
  if (req.path === '/api/v1/auth/login' || req.path === '/api/v1/auth/register') {
    return next();
  }

  const tokenFromHeader = req.headers['x-csrf-token'] as string;
  const tokenFromCookie = req.cookies?.[CSRF_COOKIE_NAME] as string;

  if (!tokenFromHeader || !tokenFromCookie) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'CSRF token missing or invalid',
    });
    return;
  }

  if (tokenFromHeader !== tokenFromCookie || !verifyCsrfToken(tokenFromHeader)) {
    logAuditEvent({
      eventType: 'CSRF_VALIDATION_FAILED',
      actorId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { path: req.originalUrl, method: req.method },
    });

    res.status(403).json({
      error: 'Forbidden',
      message: 'CSRF token verification failed',
    });
    return;
  }

  next();
}

/**
 * Security Headers configuration via Helmet
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

/**
 * Strict Cross-Origin Resource Sharing (CORS) Configuration
 */
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin blocked by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 86400, // 24 hours
});

const isTest = process.env.NODE_ENV === 'test';

/**
 * Rate Limiters for sensitive endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 5, // 5 login attempts per window in production
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTest ? 1000 : 3, // 3 registrations per hour in production
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many accounts registered from this IP. Please try again later.',
  },
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 100, // 100 requests per 15 minutes in production
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests. Please slow down.',
  },
});

/**
 * Safe Global Error Handler
 */
export function globalErrorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  }, 'Unhandled Application Error');

  if (err.message === 'Origin blocked by CORS policy') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'CORS policy violation: origin not allowed',
    });
    return;
  }

  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Malformed JSON payload in request body',
    });
    return;
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected internal error occurred. Please try again later.',
  });
}
