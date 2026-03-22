import { z } from 'zod';

import { FaceRegistrationStatus } from '../constants/faceProfile';
import {
  idParamSchema,
  objectIdSchema,
  optionalBooleanQuerySchema,
  paginationQuerySchema,
} from './common.validator';

export const createFaceProfileSchema = z.object({
  studentId: objectIdSchema,
  embeddingVersion: z.string().trim().min(1).max(100),
  embeddingCount: z.coerce.number().int().min(0),
  registrationStatus: z
    .nativeEnum(FaceRegistrationStatus)
    .default(FaceRegistrationStatus.PENDING),
  registeredAt: z.coerce.date().nullable().optional(),
  lastUpdatedAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const updateFaceProfileSchema = createFaceProfileSchema
  .omit({ studentId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const updateFaceProfileStatusSchema = z.object({
  registrationStatus: z.nativeEnum(FaceRegistrationStatus),
  registeredAt: z.coerce.date().nullable().optional(),
  lastUpdatedAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const faceProfileIdParamSchema = idParamSchema;

export const faceProfileStudentParamSchema = z.object({
  studentId: objectIdSchema,
});

export const faceProfileOverviewQuerySchema = paginationQuerySchema.extend({
  classGroupId: objectIdSchema.optional(),
  registrationStatus: z.nativeEnum(FaceRegistrationStatus).optional(),
  hasFaceProfile: optionalBooleanQuerySchema,
});
