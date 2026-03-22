import { z } from 'zod';

import { AttendanceStatus } from '../constants/attendance';
import {
  exportFormatSchema,
  idParamSchema,
  objectIdSchema,
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

export const sessionAttendanceParamSchema = z.object({
  sessionId: idParamSchema.shape.id,
});

export const studentAttendanceParamSchema = z.object({
  studentId: idParamSchema.shape.id,
});

export const classGroupAttendanceParamSchema = z.object({
  classGroupId: objectIdSchema,
});

export const sessionAttendanceRecordsQuerySchema = withOptionalDateRange({
  ...paginationQuerySchema.shape,
  status: z.nativeEnum(AttendanceStatus).optional(),
});

export const studentAttendanceHistoryQuerySchema = withOptionalDateRange({
  ...paginationQuerySchema.shape,
  status: z.nativeEnum(AttendanceStatus).optional(),
});

export const classGroupAttendanceSummaryQuerySchema = withOptionalDateRange({});

export const sessionAttendanceExportQuerySchema = z.object({
  format: exportFormatSchema,
});

export const studentAttendanceExportQuerySchema = withOptionalDateRange({
  format: exportFormatSchema,
  status: z.nativeEnum(AttendanceStatus).optional(),
});

export const classGroupAttendanceExportQuerySchema = withOptionalDateRange({
  format: exportFormatSchema,
});
