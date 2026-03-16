import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';

import { HTTP_STATUS } from '../constants/http';
import { AppError } from '../utils/AppError';

type ValidationSchema = Partial<{
  body: ZodTypeAny;
  query: ZodTypeAny;
  params: ZodTypeAny;
}>;

export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      if (schema.query) {
        req.query = schema.query.parse(req.query) as Request['query'];
      }

      if (schema.params) {
        req.params = schema.params.parse(req.params) as Request['params'];
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new AppError(
            'Request validation failed.',
            HTTP_STATUS.UNPROCESSABLE_ENTITY,
            error.flatten(),
          ),
        );
        return;
      }

      next(error);
    }
  };
};
