import { z } from 'zod';

import {
  idParamSchema,
  objectIdSchema,
  optionalBooleanQuerySchema,
  optionalObjectIdArraySchema,
  paginationQuerySchema,
} from './common.validator';

export const createSubjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(50),
  description: z.string().trim().min(2).max(500),
  creditHours: z.coerce.number().min(0).optional(),
  assignedTeacherIds: optionalObjectIdArraySchema,
  classGroupIds: optionalObjectIdArraySchema,
  isActive: z.boolean().default(true),
});

export const updateSubjectSchema = createSubjectSchema.partial();

export const subjectIdParamSchema = idParamSchema;

export const subjectListQuerySchema = paginationQuerySchema.extend({
  isActive: optionalBooleanQuerySchema,
  assignedTeacherId: objectIdSchema.optional(),
  classGroupId: objectIdSchema.optional(),
});
