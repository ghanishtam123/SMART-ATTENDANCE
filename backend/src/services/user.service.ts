import { FilterQuery } from 'mongoose';

import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import StudentModel from '../models/Student.model';
import UserModel, { User } from '../models/User.model';
import { AuthenticatedUser, RegisterInput, SafeUser } from '../types/auth.types';
import { PaginatedResult, RequestAuditContext } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';
import { auditService } from './audit.service';
import { authService } from './auth.service';
import {
  assertRoleIsManageable,
  resolveLinkedStudentId,
  resolveLinkedStudentMap,
  sanitizeUser,
} from './userAccount.service';

interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

interface UpdateUserPayload {
  fullName?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

interface UpdateUserStatusPayload {
  isActive: boolean;
}

const normalizeUserPayload = (payload: UpdateUserPayload) => {
  return {
    ...payload,
    fullName: payload.fullName?.trim(),
    email: payload.email?.trim().toLowerCase(),
  };
};

const getUserOrThrow = async (id: string) => {
  const user = await UserModel.findById(id);

  if (!user) {
    throw new AppError('User not found.', HTTP_STATUS.NOT_FOUND);
  }

  return user;
};

const assertUserCanBeManaged = (
  currentUser: AuthenticatedUser,
  targetUser: Pick<User, 'role'>,
): void => {
  assertRoleIsManageable(currentUser, targetUser.role);
};

const assertEmailUnique = async (email: string, excludeId?: string) => {
  const existingUser = await UserModel.findOne({
    email,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select('_id')
    .lean();

  if (existingUser) {
    throw new AppError(
      'A user with this email already exists.',
      HTTP_STATUS.CONFLICT,
    );
  }
};

const assertSelfManagementConstraints = (
  currentUser: AuthenticatedUser,
  targetUserId: string,
  changes: { role?: UserRole; isActive?: boolean },
) => {
  if (currentUser.userId !== targetUserId) {
    return;
  }

  if (changes.role && changes.role !== currentUser.role) {
    throw new AppError(
      'You cannot change your own role.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  if (changes.isActive === false) {
    throw new AppError(
      'You cannot deactivate your own account.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
};

const assertLastActiveSuperAdminSafety = async (
  targetUser: Pick<Awaited<ReturnType<typeof getUserOrThrow>>, 'id' | 'role' | 'isActive'>,
  changes: { role?: UserRole; isActive?: boolean },
) => {
  if (targetUser.role !== UserRole.SUPER_ADMIN || !targetUser.isActive) {
    return;
  }

  const removesActiveSuperAdmin =
    changes.isActive === false ||
    (changes.role !== undefined && changes.role !== UserRole.SUPER_ADMIN);

  if (!removesActiveSuperAdmin) {
    return;
  }

  const otherActiveSuperAdminCount = await UserModel.countDocuments({
    _id: { $ne: targetUser.id },
    role: UserRole.SUPER_ADMIN,
    isActive: true,
  });

  if (otherActiveSuperAdminCount === 0) {
    throw new AppError(
      'At least one active super_admin account must remain.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
};

const assertStudentRoleTransitionIsSafe = async (
  targetUser: Pick<Awaited<ReturnType<typeof getUserOrThrow>>, 'id' | 'role'>,
  nextRole?: UserRole,
) => {
  if (
    targetUser.role !== UserRole.STUDENT ||
    nextRole === undefined ||
    nextRole === UserRole.STUDENT
  ) {
    return;
  }

  const linkedStudentId = await resolveLinkedStudentId(targetUser.id);

  if (linkedStudentId) {
    throw new AppError(
      'Unlink the student record before changing this user away from student role.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
};

const syncLinkedStudentEmail = async (userId: string, email: string) => {
  await StudentModel.findOneAndUpdate(
    { userId },
    { $set: { email } },
  );
};

export const userService = {
  listUsers: async (
    query: UserListQuery,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<SafeUser>> => {
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const filter: FilterQuery<User> = {};

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
      ];
    }

    if (query.role) {
      filter.role = query.role;
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (currentUser.role === UserRole.ADMIN) {
      if (query.role) {
        assertRoleIsManageable(currentUser, query.role);
      }

      filter.role = query.role ?? { $in: [UserRole.TEACHER, UserRole.STUDENT] };
    }

    const [users, totalItems] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      UserModel.countDocuments(filter),
    ]);

    const linkedStudentMap = await resolveLinkedStudentMap(
      users.map((user) => user._id),
    );

    return {
      items: users.map((user) =>
        sanitizeUser(user, linkedStudentMap.get(user.id) ?? null),
      ),
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  getUserById: async (
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ user: SafeUser }> => {
    const user = await getUserOrThrow(id);
    assertUserCanBeManaged(currentUser, user);

    return {
      user: sanitizeUser(user, await resolveLinkedStudentId(user.id)),
    };
  },

  createUser: async (
    payload: RegisterInput,
    currentUser: AuthenticatedUser,
    auditContext?: RequestAuditContext,
  ): Promise<{ user: SafeUser }> => {
    return authService.register(payload, {
      currentUser,
      auditContext,
    });
  },

  updateUser: async (
    id: string,
    payload: UpdateUserPayload,
    currentUser: AuthenticatedUser,
    auditContext?: RequestAuditContext,
  ): Promise<{ user: SafeUser }> => {
    const user = await getUserOrThrow(id);
    const normalizedPayload = normalizeUserPayload(payload);

    assertUserCanBeManaged(currentUser, user);
    assertSelfManagementConstraints(currentUser, user.id, {
      role: normalizedPayload.role,
    });

    if (normalizedPayload.role) {
      assertRoleIsManageable(currentUser, normalizedPayload.role);
      await assertStudentRoleTransitionIsSafe(user, normalizedPayload.role);
    }

    await assertLastActiveSuperAdminSafety(user, {
      role: normalizedPayload.role,
    });

    if (normalizedPayload.email && normalizedPayload.email !== user.email) {
      await assertEmailUnique(normalizedPayload.email, user.id);
      user.email = normalizedPayload.email;
    }

    if (normalizedPayload.fullName) {
      user.fullName = normalizedPayload.fullName;
    }

    if (normalizedPayload.password) {
      user.password = normalizedPayload.password;
    }

    if (normalizedPayload.role) {
      user.role = normalizedPayload.role;
    }

    await user.save();

    if (user.role === UserRole.STUDENT) {
      await syncLinkedStudentEmail(user.id, user.email);
    }

    await auditService.logAction({
      ...auditContext,
      actorUserId: currentUser.userId,
      action: 'user.update',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        updatedFields: Object.keys(payload),
        role: user.role,
        isActive: user.isActive,
      },
    });

    return {
      user: sanitizeUser(user, await resolveLinkedStudentId(user.id)),
    };
  },

  updateUserStatus: async (
    id: string,
    payload: UpdateUserStatusPayload,
    currentUser: AuthenticatedUser,
    auditContext?: RequestAuditContext,
  ): Promise<{ user: SafeUser }> => {
    const user = await getUserOrThrow(id);

    assertUserCanBeManaged(currentUser, user);
    assertSelfManagementConstraints(currentUser, user.id, {
      isActive: payload.isActive,
    });
    await assertLastActiveSuperAdminSafety(user, {
      isActive: payload.isActive,
    });

    user.isActive = payload.isActive;
    await user.save();
    await auditService.logAction({
      ...auditContext,
      actorUserId: currentUser.userId,
      action: 'user.status.update',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        isActive: user.isActive,
        role: user.role,
      },
    });

    return {
      user: sanitizeUser(user, await resolveLinkedStudentId(user.id)),
    };
  },
};
