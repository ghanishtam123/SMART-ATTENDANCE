import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import env from '../config/env';
import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import { StudentStatus } from '../constants/student';
import StudentModel from '../models/Student.model';
import UserModel from '../models/User.model';
import { AuthTokenPayload, AuthenticatedUser } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

const getBearerToken = (authorizationHeader?: string): string | null => {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authorizationHeader.slice(7).trim();
};

const verifyAccessToken = (token: string): AuthTokenPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
  } catch {
    throw new AppError(
      'Invalid or expired authentication token.',
      HTTP_STATUS.UNAUTHORIZED,
    );
  }
};

const resolveAuthenticatedUser = async (token: string): Promise<AuthenticatedUser> => {
  const payload = verifyAccessToken(token);

  const user = await UserModel.findById(payload.userId)
    .select('_id email role isActive')
    .lean();

  if (!user || !user.isActive) {
    throw new AppError(
      'Authenticated user is not available.',
      HTTP_STATUS.UNAUTHORIZED,
    );
  }

  let studentId: string | null = null;

  if (user.role === UserRole.STUDENT) {
    const student = (await StudentModel.findOne({
      userId: user._id,
      status: StudentStatus.ACTIVE,
    })
      .select('_id')
      .lean()) as { _id: unknown } | null;

    if (!student) {
      throw new AppError(
        'Authenticated student profile is not available.',
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    studentId = String(student._id);
  }

  return {
    userId: String(user._id),
    email: user.email,
    role: user.role,
    studentId,
  };
};

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    throw new AppError(
      'Authentication token is required.',
      HTTP_STATUS.UNAUTHORIZED,
    );
  }

  req.user = await resolveAuthenticatedUser(token);
  next();
});

export const authenticateOptional = asyncHandler(async (req, _res, next) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    next();
    return;
  }

  req.user = await resolveAuthenticatedUser(token);
  next();
});

export const authenticateAiService = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const apiKey = req.headers['x-api-key'];

  if (typeof apiKey !== 'string' || apiKey !== env.AI_INTERNAL_API_KEY) {
    next(
      new AppError(
        'Invalid or missing internal AI service API key.',
        HTTP_STATUS.UNAUTHORIZED,
      ),
    );
    return;
  }

  next();
};
