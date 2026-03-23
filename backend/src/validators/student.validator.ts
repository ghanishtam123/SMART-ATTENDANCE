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

const studentLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  isActive: z.boolean().optional(),
});

const studentBaseSchema = z.object({
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

export const createStudentSchema = studentBaseSchema
  .extend({
    createLoginAccount: z.boolean().default(false),
    login: studentLoginSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.createLoginAccount) {
      if (value.userId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['userId'],
          message: 'Do not provide userId when creating a linked login account.',
        });
      }

      if (!value.login) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['login'],
          message: 'Login details are required when createLoginAccount is true.',
        });
      }
    }

    if (!value.createLoginAccount && value.login) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['login'],
        message: 'Login details can only be provided when createLoginAccount is true.',
      });
    }

    if (
      value.createLoginAccount &&
      value.login &&
      value.email &&
      value.email.trim().toLowerCase() !== value.login.email.trim().toLowerCase()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['login', 'email'],
        message: 'Student email and login email must match.',
      });
    }
  });

export const updateStudentSchema = studentBaseSchema
  .omit({ userId: true })
  .partial()
  .extend({
    userId: objectIdSchema.nullable().optional(),
    createLoginAccount: z.never().optional(),
    login: z.never().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const studentIdParamSchema = idParamSchema;

export const studentListQuerySchema = paginationQuerySchema.extend({
  classGroupId: objectIdSchema.optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  hasEmail: optionalBooleanQuerySchema,
});
