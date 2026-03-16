import { z } from 'zod';

import {
  idParamSchema,
  objectIdSchema,
  optionalBooleanQuerySchema,
  paginationQuerySchema,
} from './common.validator';

export const unknownFaceAlertIdParamSchema = idParamSchema;

export const unknownFaceAlertListQuerySchema = paginationQuerySchema.extend({
  sessionId: objectIdSchema.optional(),
  cameraId: z.string().trim().min(1).optional(),
  reviewed: optionalBooleanQuerySchema,
});

export const markUnknownFaceAlertReviewedSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});
