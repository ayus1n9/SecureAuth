import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { logger } from './logging/logger.js';
import { disconnectDb } from './database/db.js';

const PORT = parseInt(process.env.PORT || '5000', 10);
const app = createApp();

const server = app.listen(PORT, () => {
  logger.info({
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  }, `SecureAuth backend service listening on port ${PORT}`);
});

async function handleShutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown initiated');
  server.close(async () => {
    logger.info('HTTP server closed');
    await disconnectDb();
    logger.info('Database connection closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forceful shutdown timeout reached');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
