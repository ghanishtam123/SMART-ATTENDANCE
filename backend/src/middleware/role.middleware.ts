import { NextFunction, Request, Response } from 'express';

import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import { AppError } from '../utils/AppError';

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(
        new AppError(
          'Authentication is required to access this resource.',
          HTTP_STATUS.UNAUTHORIZED,
        ),
      );
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          'You do not have permission to access this resource.',
          HTTP_STATUS.FORBIDDEN,
        ),
      );
      return;
    }

    next();
  };
};
