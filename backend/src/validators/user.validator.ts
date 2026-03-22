import { z } from 'zod';

import { UserRole } from '../constants/roles';
import {
  idParamSchema,
  optionalBooleanQuerySchema,
  paginationQuerySchema,
} from './common.validator';

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(UserRole),
});

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().optional(),
    password: z.string().min(8).max(128).optional(),
    role: z.nativeEnum(UserRole).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const userIdParamSchema = idParamSchema;

export const userListQuerySchema = paginationQuerySchema.extend({
  role: z.nativeEnum(UserRole).optional(),
  isActive: optionalBooleanQuerySchema,
});
