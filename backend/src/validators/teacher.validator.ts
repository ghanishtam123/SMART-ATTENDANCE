import { z } from 'zod';

import {
  idParamSchema,
  objectIdSchema,
  optionalObjectIdArraySchema,
  paginationQuerySchema,
} from './common.validator';

const teacherLoginSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  isActive: z.boolean().optional(),
});

const teacherBaseSchema = z.object({
  userId: objectIdSchema.optional(),
  employeeId: z.string().trim().min(1).max(50),
  department: z.string().trim().min(2).max(100),
  designation: z.string().trim().min(2).max(100),
  subjectsTaught: optionalObjectIdArraySchema,
  assignedClassGroups: optionalObjectIdArraySchema,
});

export const createTeacherProfileSchema = teacherBaseSchema
  .extend({
    createLoginAccount: z.boolean().default(false),
    login: teacherLoginSchema.optional(),
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

      return;
    }

    if (value.login) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['login'],
        message: 'Login details can only be provided when createLoginAccount is true.',
      });
    }

    if (!value.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['userId'],
        message: 'Provide userId or createLoginAccount for the teacher profile.',
      });
    }
  });

export const updateTeacherProfileSchema = teacherBaseSchema
  .partial()
  .extend({
    createLoginAccount: z.never().optional(),
    login: z.never().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const teacherIdParamSchema = idParamSchema;

export const teacherListQuerySchema = paginationQuerySchema.extend({
  department: z.string().trim().min(1).optional(),
  designation: z.string().trim().min(1).optional(),
  userId: objectIdSchema.optional(),
});
