import { z } from 'zod';

import { AttendanceStatus } from '../constants/attendance';
import {
  exportFormatSchema,
  paginationQuerySchema,
} from './common.validator';

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

export const studentPortalOverviewQuerySchema = withOptionalDateRange({
  threshold: z.coerce.number().min(0).max(100).default(75),
});

export const studentPortalAttendanceHistoryQuerySchema = withOptionalDateRange({
  ...paginationQuerySchema.shape,
  status: z.nativeEnum(AttendanceStatus).optional(),
});

export const studentPortalSubjectsQuerySchema = withOptionalDateRange({
  ...paginationQuerySchema.shape,
  threshold: z.coerce.number().min(0).max(100).default(75),
});

export const studentPortalSessionHistoryQuerySchema = withOptionalDateRange({
  ...paginationQuerySchema.shape,
  status: z.nativeEnum(AttendanceStatus).optional(),
});

export const studentPortalAttendanceExportQuerySchema = withOptionalDateRange({
  search: z.string().trim().min(1).optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  format: exportFormatSchema,
});
