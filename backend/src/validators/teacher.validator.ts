import { z } from 'zod';

import {
  idParamSchema,
  objectIdSchema,
  optionalObjectIdArraySchema,
  paginationQuerySchema,
} from './common.validator';

export const createTeacherProfileSchema = z.object({
  userId: objectIdSchema,
  employeeId: z.string().trim().min(1).max(50),
  department: z.string().trim().min(2).max(100),
  designation: z.string().trim().min(2).max(100),
  subjectsTaught: optionalObjectIdArraySchema,
  assignedClassGroups: optionalObjectIdArraySchema,
});

export const updateTeacherProfileSchema = createTeacherProfileSchema.partial();

export const teacherIdParamSchema = idParamSchema;

export const teacherListQuerySchema = paginationQuerySchema.extend({
  department: z.string().trim().min(1).optional(),
  designation: z.string().trim().min(1).optional(),
  userId: objectIdSchema.optional(),
});
