import { z } from 'zod';

import {
  StudentGender,
  StudentStatus,
} from '../constants/student';
import {
  idParamSchema,
  objectIdSchema,
  optionalBooleanQuerySchema,
  paginationQuerySchema,
} from './common.validator';

const phoneRegex = /^[0-9+\-\s()]{7,20}$/;

export const createStudentSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(1).max(60),
  rollNumber: z.string().trim().min(1).max(50),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().regex(phoneRegex, 'Invalid phone number.').optional(),
  gender: z.nativeEnum(StudentGender).optional(),
  userId: objectIdSchema.optional(),
  classGroupId: objectIdSchema,
  status: z.nativeEnum(StudentStatus).default(StudentStatus.ACTIVE),
  faceProfileId: objectIdSchema.optional(),
});

export const updateStudentSchema = createStudentSchema
  .omit({ userId: true })
  .partial()
  .extend({
    userId: objectIdSchema.nullable().optional(),
  });

export const studentIdParamSchema = idParamSchema;

export const studentListQuerySchema = paginationQuerySchema.extend({
  classGroupId: objectIdSchema.optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  hasEmail: optionalBooleanQuerySchema,
});
