import { z } from 'zod';

import { objectIdSchema, paginationQuerySchema } from './common.validator';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateStringSchema = z
  .string()
  .regex(dateRegex, 'Date must be in YYYY-MM-DD format.');

const withOptionalDateRange = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({
      ...shape,
      from: dateStringSchema.optional(),
      to: dateStringSchema.optional(),
    })
    .refine(
      (value) => {
        const range = value as { from?: string; to?: string };
        return !range.from || !range.to || range.from <= range.to;
      },
      {
        message: 'The from date must be on or before the to date.',
        path: ['to'],
      },
    );

export const analyticsOverviewQuerySchema = withOptionalDateRange({
  classGroupId: objectIdSchema.optional(),
});

export const lowAttendanceQuerySchema = withOptionalDateRange({
  ...paginationQuerySchema.shape,
  classGroupId: objectIdSchema.optional(),
  threshold: z.coerce.number().min(0).max(100).default(75),
});

export const lateEntriesQuerySchema = withOptionalDateRange({
  ...paginationQuerySchema.shape,
  classGroupId: objectIdSchema.optional(),
});

export const sessionAbsenteesParamSchema = z.object({
  sessionId: objectIdSchema,
});

export const sessionAbsenteesQuerySchema = paginationQuerySchema;
