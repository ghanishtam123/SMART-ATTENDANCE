import { NextFunction, Request, Response } from 'express';

import { HTTP_STATUS } from '../constants/http';
import { AppError } from '../utils/AppError';

export const notFoundMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, HTTP_STATUS.NOT_FOUND));
};
