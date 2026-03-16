import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import env from './config/env';
import { requestLogger } from './middleware/requestLogger.middleware';
import { errorHandler } from './middleware/error.middleware';
import { notFoundMiddleware } from './middleware/notFound.middleware';
import apiRouter from './routes';
import { ApiResponse } from './utils/ApiResponse';

const app = express();

const corsOrigin =
  env.CORS_ORIGIN === '*'
    ? true
    : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

app.disable('x-powered-by');
app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);

app.use(helmet());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  return ApiResponse.success(res, {
    message: 'Smart attendance backend is healthy.',
    data: {
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      version: 'v1',
    },
  });
});

app.use(env.API_PREFIX, apiRouter);

app.use(notFoundMiddleware);
app.use(errorHandler);

export default app;
