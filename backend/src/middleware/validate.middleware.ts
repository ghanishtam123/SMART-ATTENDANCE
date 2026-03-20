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
        const parsedQuery = schema.query.parse(req.query) as Request['query'];

        for (const key of Object.keys(req.query)) {
          delete req.query[key];
        }

        Object.assign(req.query, parsedQuery);
      }

      if (schema.params) {
        const parsedParams = schema.params.parse(req.params) as Request['params'];

        for (const key of Object.keys(req.params)) {
          delete req.params[key];
        }

        Object.assign(req.params, parsedParams);
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
