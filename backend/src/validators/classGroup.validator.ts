import { z } from 'zod';

import {
  idParamSchema,
  optionalBooleanQuerySchema,
  paginationQuerySchema,
} from './common.validator';

export const createClassGroupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(1).max(50),
  department: z.string().trim().min(2).max(100),
  semester: z.coerce.number().int().positive(),
  section: z.string().trim().min(1).max(20),
  academicYear: z.string().trim().min(4).max(20),
  isActive: z.boolean().default(true),
});

export const updateClassGroupSchema = createClassGroupSchema.partial();

export const classGroupIdParamSchema = idParamSchema;

export const classGroupListQuerySchema = paginationQuerySchema.extend({
  department: z.string().trim().min(1).optional(),
  semester: z.coerce.number().int().positive().optional(),
  academicYear: z.string().trim().min(1).optional(),
  isActive: optionalBooleanQuerySchema,
});
