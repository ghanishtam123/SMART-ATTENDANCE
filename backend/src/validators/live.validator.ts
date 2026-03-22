import { z } from 'zod';

import { objectIdSchema } from './common.validator';

const limitSchema = z.coerce.number().int().positive().max(100).default(20);

export const activeSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export const liveSessionIdParamSchema = z.object({
  sessionId: objectIdSchema,
});

export const recentEventsQuerySchema = z.object({
  limit: limitSchema,
});

export const recentAlertsQuerySchema = z.object({
  limit: limitSchema,
});
