import http from 'node:http';

import app from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import env from './config/env';
import { sessionSchedulerService } from './services/sessionScheduler.service';

let server: http.Server | null = null;

const shutdown = async (signal: string): Promise<void> => {
  console.log(`INFO | Received ${signal}. Shutting down gracefully.`);

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
    console.log(
      `INFO | Smart attendance backend listening on port ${env.PORT} with API prefix ${env.API_PREFIX}.`,
    );
  });

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    console.error('ERROR | Unhandled promise rejection.', { reason });
    void shutdown('UNHANDLED_REJECTION');
  });
  process.on('uncaughtException', (error) => {
    console.error('FATAL | Uncaught exception.', { err: error });
    void shutdown('UNCAUGHT_EXCEPTION');
  });
};

void startServer().catch((error: unknown) => {
  console.error('ERROR | Failed to start the backend server.', { error });
  process.exit(1);
});
