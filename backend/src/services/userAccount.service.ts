import { Types } from 'mongoose';

import env from '../config/env';
import { HTTP_STATUS } from '../constants/http';
import {
  ADMIN_MANAGED_USER_ROLES,
  USER_ROLE_VALUES,
  UserRole,
} from '../constants/roles';
import StudentModel from '../models/Student.model';
import UserModel, { UserDocument } from '../models/User.model';
import {
  AuthenticatedUser,
  RegisterInput,
  SafeUser,
} from '../types/auth.types';
import { RequestAuditContext } from '../types/common.types';
import { AppError } from '../utils/AppError';
import { auditService } from './audit.service';

interface UserCreationContext {
  currentUser?: AuthenticatedUser;
  bootstrapSecret?: string;
}

interface ManagedUserCreationContext extends UserCreationContext {
  auditContext?: RequestAuditContext;
}

export interface ManagedRegisterInput extends RegisterInput {
  isActive?: boolean;
}

export const getManageableUserRoles = (role: UserRole): UserRole[] => {
  if (role === UserRole.SUPER_ADMIN) {
    return USER_ROLE_VALUES;
  }

  if (role === UserRole.ADMIN) {
    return ADMIN_MANAGED_USER_ROLES;
  }

  return [];
};

export const assertRoleIsManageable = (
  currentUser: AuthenticatedUser,
  targetRole: UserRole,
  message = 'You do not have permission to manage a user with this role.',
): void => {
  if (!getManageableUserRoles(currentUser.role).includes(targetRole)) {
    throw new AppError(message, HTTP_STATUS.FORBIDDEN);
  }
};

export const sanitizeUser = (
  user: UserDocument,
  linkedStudentId: string | null = null,
): SafeUser => {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    linkedStudentId,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? null,
    createdBy: user.createdBy ? user.createdBy.toString() : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const resolveLinkedStudentMap = async (
  userIds: Array<string | Types.ObjectId>,
): Promise<Map<string, string>> => {
  const normalizedUserIds = [...new Set(userIds.map((userId) => String(userId)))];

  if (normalizedUserIds.length === 0) {
    return new Map();
  }

  const linkedStudents = await StudentModel.find({
    userId: { $in: normalizedUserIds },
  })
    .select('_id userId')
    .lean();

  return new Map(
    linkedStudents
      .filter((student) => student.userId)
      .map((student) => [String(student.userId), String(student._id)]),
  );
};

export const resolveLinkedStudentId = async (
  userId: string | Types.ObjectId,
): Promise<string | null> => {
  const linkedStudentMap = await resolveLinkedStudentMap([userId]);
  return linkedStudentMap.get(String(userId)) ?? null;
};

export const assertUserCreationAllowed = async (
  targetRole: UserRole,
  context: UserCreationContext,
): Promise<Types.ObjectId | null> => {
  const totalUsers = await UserModel.countDocuments();

  if (totalUsers === 0) {
    if (!env.AUTH_BOOTSTRAP_ENABLED) {
      throw new AppError(
        'Initial super_admin bootstrap is disabled.',
        HTTP_STATUS.FORBIDDEN,
      );
    }

    if (targetRole !== UserRole.SUPER_ADMIN) {
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

  assertRoleIsManageable(
    context.currentUser,
    targetRole,
    'You are not allowed to create a user with this role.',
  );

  return new Types.ObjectId(context.currentUser.userId);
};

export const createManagedUserAccount = async (
  payload: ManagedRegisterInput,
  context: ManagedUserCreationContext,
): Promise<UserDocument> => {
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
    isActive: payload.isActive ?? true,
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
      isActive: user.isActive,
      bootstrapCreated: !context.currentUser,
    },
  });

  return user;
};
