import { z } from 'zod';

import { TimetableDayOfWeek } from '../constants/timetable';
import {
  idParamSchema,
  objectIdSchema,
  optionalBooleanQuerySchema,
  paginationQuerySchema,
} from './common.validator';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeStringSchema = z
  .string()
  .regex(timeRegex, 'Time must be in HH:mm format.');

export const createTimetableEntrySchema = z.object({
  classGroupId: objectIdSchema,
  subjectId: objectIdSchema,
  teacherId: objectIdSchema,
  classroomId: objectIdSchema,
  dayOfWeek: z.nativeEnum(TimetableDayOfWeek),
  startTime: timeStringSchema,
  endTime: timeStringSchema,
  cameraIds: z.array(z.string().trim().min(1).max(100)).default([]),
  isActive: z.boolean().default(true),
  notes: z.string().trim().max(1000).optional(),
});

export const updateTimetableEntrySchema = createTimetableEntrySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const timetableEntryIdParamSchema = idParamSchema;

export const timetableListQuerySchema = paginationQuerySchema.extend({
  dayOfWeek: z.nativeEnum(TimetableDayOfWeek).optional(),
  classGroupId: objectIdSchema.optional(),
  teacherId: objectIdSchema.optional(),
  classroomId: objectIdSchema.optional(),
  isActive: optionalBooleanQuerySchema,
});
