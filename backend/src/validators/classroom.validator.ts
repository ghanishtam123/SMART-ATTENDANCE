import { z } from 'zod';

import {
  idParamSchema,
  optionalBooleanQuerySchema,
  paginationQuerySchema,
} from './common.validator';

export const createClassroomSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(1).max(50),
  building: z.string().trim().min(1).max(100),
  floor: z.string().trim().min(1).max(50),
  capacity: z.coerce.number().int().positive(),
  cameraIds: z.array(z.string().trim().min(1).max(100)).default([]),
  isActive: z.boolean().default(true),
});

export const updateClassroomSchema = createClassroomSchema.partial();

export const classroomIdParamSchema = idParamSchema;

export const classroomListQuerySchema = paginationQuerySchema.extend({
  building: z.string().trim().min(1).optional(),
  isActive: optionalBooleanQuerySchema,
});
