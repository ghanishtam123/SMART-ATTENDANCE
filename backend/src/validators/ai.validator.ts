import { z } from 'zod';

import { objectIdSchema } from './common.validator';

const isoDateTimeSchema = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'Invalid timestamp.',
);

const boundingBoxSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  w: z.number().positive(),
  h: z.number().positive(),
});

const recognitionEventSchema = z
  .object({
    studentId: objectIdSchema.nullable(),
    isUnknown: z.boolean(),
    confidence: z.number().min(0).max(1),
    timestamp: isoDateTimeSchema,
    boundingBox: boundingBoxSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((event, ctx) => {
    if (event.isUnknown && event.studentId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unknown events must not include a studentId.',
        path: ['studentId'],
      });
    }

    if (!event.isUnknown && event.studentId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Recognized events must include a studentId.',
        path: ['studentId'],
      });
    }
  });

export const recognitionBatchSchema = z.object({
  sessionId: objectIdSchema,
  cameraId: z.string().trim().min(1).max(100),
  events: z.array(recognitionEventSchema).min(1),
});
