import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const rawEnv = {
  ...process.env,
  AI_INTERNAL_API_KEY:
    process.env.AI_INTERNAL_API_KEY ?? process.env.AI_SERVICE_API_KEY,
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().min(1).default('/api/v1'),
  MONGODB_URI: z
    .string()
    .min(1)
    .default('mongodb://127.0.0.1:27017/smart-attendance'),
  CORS_ORIGIN: z.string().min(1).default('*'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(300),
  JWT_SECRET: z.string().min(16).default('change-this-jwt-secret-key'),
  JWT_EXPIRES_IN: z.string().min(1).default('1d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),
  AUTH_BOOTSTRAP_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  AUTH_BOOTSTRAP_SECRET: z.string().min(12).default('change-this-bootstrap-secret'),
  AI_INTERNAL_API_KEY: z
    .string()
    .min(16)
    .default('change-this-ai-internal-api-key'),
})
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') {
      return;
    }

    if (value.JWT_SECRET === 'change-this-jwt-secret-key') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be changed for production.',
      });
    }

    if (value.AI_INTERNAL_API_KEY === 'change-this-ai-internal-api-key') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_INTERNAL_API_KEY'],
        message: 'AI_INTERNAL_API_KEY must be changed for production.',
      });
    }

    if (value.CORS_ORIGIN === '*') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN cannot be "*" in production.',
      });
    }

    if (
      value.AUTH_BOOTSTRAP_ENABLED &&
      value.AUTH_BOOTSTRAP_SECRET === 'change-this-bootstrap-secret'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_BOOTSTRAP_SECRET'],
        message: 'AUTH_BOOTSTRAP_SECRET must be changed when bootstrap is enabled in production.',
      });
    }
  });

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const issueText = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');

  throw new Error(`Invalid environment configuration: ${issueText}`);
}

export const env = parsed.data;

export default env;
