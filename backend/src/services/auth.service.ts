import jwt, { SignOptions } from 'jsonwebtoken';

import env from '../config/env';
import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import { StudentStatus } from '../constants/student';
import StudentModel from '../models/Student.model';
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
import {
  assertUserCreationAllowed,
  resolveLinkedStudentId,
  sanitizeUser,
} from './userAccount.service';

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

const signAccessToken = (payload: AuthTokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
};

const resolveLinkedStudentIdForUser = async (
  user: Pick<UserDocument, '_id' | 'role'>,
): Promise<string | null> => {
  if (user.role !== UserRole.STUDENT) {
    return null;
  }

  return resolveLinkedStudentId(user._id);
};

const assertStudentCanAuthenticate = async (user: Pick<UserDocument, '_id' | 'role'>) => {
  if (user.role !== UserRole.STUDENT) {
    return null;
  }

  const linkedStudent = (await StudentModel.findOne({
    userId: user._id,
    status: StudentStatus.ACTIVE,
  })
    .select('_id')
    .lean()) as { _id: unknown } | null;

  if (!linkedStudent) {
    throw new AppError(
      'Student login is not available until the student account is linked and active.',
      HTTP_STATUS.FORBIDDEN,
    );
  }

  return String(linkedStudent._id);
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

    const createdBy = await assertUserCreationAllowed(
      payload.role,
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

    const linkedStudentId = await assertStudentCanAuthenticate(user);

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
        linkedStudentId,
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
      user: sanitizeUser(user, linkedStudentId),
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
      user: sanitizeUser(
        user,
        await resolveLinkedStudentIdForUser(user),
      ),
    };
  },
};
