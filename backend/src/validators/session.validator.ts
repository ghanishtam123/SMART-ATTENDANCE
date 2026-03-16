import { z } from 'zod';

import { SessionStatus } from '../constants/session';
import {
  idParamSchema,
  objectIdSchema,
  paginationQuerySchema,
} from './common.validator';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dateStringSchema = z
  .string()
  .regex(dateRegex, 'Date must be in YYYY-MM-DD format.');

const timeStringSchema = z
  .string()
  .regex(timeRegex, 'Time must be in HH:mm format.');

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  classGroupId: objectIdSchema,
  subjectId: objectIdSchema,
  teacherId: objectIdSchema,
  classroomId: objectIdSchema,
  cameraIds: z.array(z.string().trim().min(1).max(100)).default([]),
  scheduledDate: dateStringSchema,
  scheduledStartTime: timeStringSchema,
  scheduledEndTime: timeStringSchema,
  graceMinutesForLate: z.coerce.number().int().min(0),
  minimumPresenceMinutes: z.coerce.number().int().min(0),
  minimumPresencePercentage: z.coerce.number().min(0).max(100),
  notes: z.string().trim().max(1000).optional(),
});

export const updateSessionSchema = createSessionSchema.partial();

export const sessionIdParamSchema = idParamSchema;

export const sessionListQuerySchema = paginationQuerySchema.extend({
  scheduledDate: dateStringSchema.optional(),
  teacherId: objectIdSchema.optional(),
  classGroupId: objectIdSchema.optional(),
  subjectId: objectIdSchema.optional(),
  status: z.nativeEnum(SessionStatus).optional(),
});
