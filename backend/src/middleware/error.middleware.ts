import { NextFunction, Request, Response } from 'express';

import env from '../config/env';
import { HTTP_STATUS } from '../constants/http';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

const normalizeError = (
  error: Error,
): { statusCode: number; message: string; details?: unknown } => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      details: error.details,
    };
  }

  if (
    error instanceof SyntaxError &&
    'body' in error &&
    typeof error.message === 'string'
  ) {
    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      message: 'Invalid JSON request payload.',
    };
  }

  const errorWithCode = error as Error & { code?: number; keyPattern?: unknown };

  if (errorWithCode.code === 11000) {
    return {
      statusCode: HTTP_STATUS.CONFLICT,
      message: 'A record with one of the unique fields already exists.',
      details: errorWithCode.keyPattern,
    };
  }

  if (error.name === 'ValidationError') {
    return {
      statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      message: 'Validation failed while processing the request.',
    };
  }

  if (error.name === 'CastError') {
    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      message: 'An invalid identifier or value was provided.',
    };
  }

  return {
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: error.message,
  };
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): Response => {
  const normalizedError = normalizeError(error);

  console.error(`ERROR | ${error.message}`, {
    err: error,
    method: req.method,
    path: req.originalUrl,
  });

  return ApiResponse.error(res, {
    statusCode: normalizedError.statusCode,
    message:
      normalizedError.statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR &&
      env.NODE_ENV === 'production'
        ? 'Something went wrong.'
        : normalizedError.message,
    error:
      env.NODE_ENV === 'production'
        ? undefined
        : {
            stack: error.stack,
            details: normalizedError.details,
          },
  });
};
