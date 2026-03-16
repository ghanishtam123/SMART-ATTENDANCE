import jwt, { SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';

import env from '../config/env';
import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import UserModel, { UserDocument } from '../models/User.model';
import {
  AuthTokenPayload,
  AuthenticatedUser,
  LoginInput,
  RegisterInput,
  SafeUser,
} from '../types/auth.types';
import { RequestAuditContext } from '../types/common.types';
import { AppError } from '../utils/AppError';
import { auditService } from './audit.service';

interface RegisterContext {
  currentUser?: AuthenticatedUser;
  bootstrapSecret?: string;
  auditContext?: RequestAuditContext;
}

interface LoginResponse {
  user: SafeUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

const sanitizeUser = (user: UserDocument): SafeUser => {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? null,
    createdBy: user.createdBy ? user.createdBy.toString() : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const signAccessToken = (payload: AuthTokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
};

const assertRegistrationAllowed = async (
  payload: RegisterInput,
  context: RegisterContext,
): Promise<Types.ObjectId | null> => {
  const totalUsers = await UserModel.countDocuments();

  if (totalUsers === 0) {
    if (!env.AUTH_BOOTSTRAP_ENABLED) {
      throw new AppError(
        'Initial super_admin bootstrap is disabled.',
        HTTP_STATUS.FORBIDDEN,
      );
    }

    if (payload.role !== UserRole.SUPER_ADMIN) {
      throw new AppError(
        'The first user must be created with the super_admin role.',
        HTTP_STATUS.FORBIDDEN,
      );
    }

    if (context.bootstrapSecret !== env.AUTH_BOOTSTRAP_SECRET) {
      throw new AppError(
        'Invalid bootstrap secret.',
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    return null;
  }

  if (!context.currentUser) {
    throw new AppError(
      'Registration is restricted to authenticated administrators.',
      HTTP_STATUS.FORBIDDEN,
    );
  }

  if (context.currentUser.role === UserRole.SUPER_ADMIN) {
    return new Types.ObjectId(context.currentUser.userId);
  }

  if (context.currentUser.role === UserRole.ADMIN && payload.role === UserRole.TEACHER) {
    return new Types.ObjectId(context.currentUser.userId);
  }

  throw new AppError(
    'You are not allowed to create a user with this role.',
    HTTP_STATUS.FORBIDDEN,
  );
};

export const authService = {
  register: async (
    payload: RegisterInput,
    context: RegisterContext,
  ): Promise<{ user: SafeUser }> => {
    const normalizedEmail = payload.email.trim().toLowerCase();

    const existingUser = await UserModel.findOne({ email: normalizedEmail })
      .select('_id')
      .lean();

    if (existingUser) {
      throw new AppError(
        'A user with this email already exists.',
        HTTP_STATUS.CONFLICT,
      );
    }

    const createdBy = await assertRegistrationAllowed(
      { ...payload, email: normalizedEmail },
      context,
    );

    const user = new UserModel({
      fullName: payload.fullName.trim(),
      email: normalizedEmail,
      password: payload.password,
      role: payload.role,
      createdBy,
    });

    await user.save();
    await auditService.logAction({
      ...context.auditContext,
      actorUserId: context.currentUser?.userId ?? null,
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role,
        bootstrapCreated: !context.currentUser,
      },
    });

    return {
      user: sanitizeUser(user),
    };
  },

  login: async (
    payload: LoginInput,
    auditContext?: RequestAuditContext,
  ): Promise<LoginResponse> => {
    const normalizedEmail = payload.email.trim().toLowerCase();

    const user = await UserModel.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      throw new AppError(
        'Invalid email or password.',
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    if (!user.isActive) {
      throw new AppError(
        'Your account is inactive.',
        HTTP_STATUS.FORBIDDEN,
      );
    }

    const passwordMatches = await user.comparePassword(payload.password);

    if (!passwordMatches) {
      throw new AppError(
        'Invalid email or password.',
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    user.lastLoginAt = new Date();
    await user.save();
    await auditService.logAction({
      ...auditContext,
      actorUserId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
    });

    const tokenPayload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = signAccessToken(tokenPayload);

    return {
      user: sanitizeUser(user),
      accessToken,
      tokenType: 'Bearer',
      expiresIn: env.JWT_EXPIRES_IN,
    };
  },

  getCurrentUser: async (authenticatedUser: AuthenticatedUser): Promise<{ user: SafeUser }> => {
    const user = await UserModel.findById(authenticatedUser.userId);

    if (!user || !user.isActive) {
      throw new AppError(
        'Authenticated user is not available.',
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    return {
      user: sanitizeUser(user),
    };
  },
};
