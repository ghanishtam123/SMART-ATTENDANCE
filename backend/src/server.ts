import http from 'node:http';

import app from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import env from './config/env';
import logger from './config/logger';
import { sessionSchedulerService } from './services/sessionScheduler.service';

let server: http.Server | null = null;

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}. Shutting down gracefully.`);

  sessionSchedulerService.stop();

  if (!server) {
    await disconnectDatabase();
    process.exit(0);
  }

  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
};

const startServer = async (): Promise<void> => {
  await connectDatabase();
  sessionSchedulerService.start();

  server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info(
      `Smart attendance backend listening on port ${env.PORT} with API prefix ${env.API_PREFIX}.`,
    );
  });

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection.');
    void shutdown('UNHANDLED_REJECTION');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception.');
    void shutdown('UNCAUGHT_EXCEPTION');
  });
};

void startServer().catch((error: unknown) => {
  logger.error({ error }, 'Failed to start the backend server.');
  process.exit(1);
});
