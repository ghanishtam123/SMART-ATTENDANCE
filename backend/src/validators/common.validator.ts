import { z } from 'zod';

export const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const objectIdSchema = z
  .string()
  .regex(objectIdRegex, 'Invalid MongoDB ObjectId.');

export const idParamSchema = z.object({
  id: objectIdSchema,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
});

export const optionalBooleanQuerySchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}, z.boolean().optional());

export const optionalObjectIdArraySchema = z
  .array(objectIdSchema)
  .default([]);

export const exportFormatSchema = z.enum(['json', 'csv']).default('json');
