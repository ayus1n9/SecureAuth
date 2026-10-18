import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import {
  helmetMiddleware,
  corsMiddleware,
  csrfProtection,
  apiLimiter,
  globalErrorHandler,
} from './middleware/security.js';
import { authRouter } from './routes/auth.routes.js';
import { recordsRouter } from './routes/records.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { adminRouter } from './routes/admin.routes.js';

export function createApp(): Express {
  const app = express();

  // Trust proxy for secure cookies and accurate IP rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Core Security Headers via Helmet
  app.use(helmetMiddleware);

  // Cross-Origin Resource Sharing
  app.use(corsMiddleware);

  // General API Rate Limiting (exempt in test environment)
  if (process.env.NODE_ENV !== 'test') {
    app.use('/api/', apiLimiter);
  }

  // Cookie parsing for stateful session ID and CSRF tokens
  app.use(cookieParser());

  // Strict body parsing limits prevent memory exhaustion / DoS attacks
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  // CSRF validation on all state-changing endpoints
  app.use(csrfProtection);

  // Health check endpoint (exempt from CSRF and auth)
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
  });

  // Mount API routers under versioned prefix
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/records', recordsRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/admin', adminRouter);

  // Catch-all 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `The requested resource '${req.originalUrl}' does not exist`,
    });
  });

  // Safe global error handler
  app.use(globalErrorHandler);

  return app;
}
