import app from './app';
import { env } from './config/env';
import logger from './config/logger';
import prisma from './config/db';
import { shutdownWorkers } from './jobs/index';

const server = app.listen(env.PORT, () => {
  logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  logger.info(`Swagger API documentation: http://localhost:${env.PORT}/api-docs`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received signal ${signal}. Starting graceful shutdown...`);

  // Close HTTP Server first, refusing new connections
  server.close(async () => {
    logger.info('Express HTTP server closed.');

    try {
      // Disconnect DB client
      await prisma.$disconnect();
      logger.info('Prisma database client disconnected.');

      // Shut down queue workers and redis connections
      await shutdownWorkers();
    } catch (err: any) {
      logger.error('Error occurred during graceful shutdown: %s', err.stack || err.message);
    }

    logger.info('Shutdown complete. Exiting process.');
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Force exiting.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
