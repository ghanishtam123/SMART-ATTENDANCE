import { FilterQuery } from 'mongoose';

import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import ClassGroupModel from '../models/ClassGroup.model';
import SubjectModel from '../models/Subject.model';
import TeacherProfileModel, {
  TeacherProfile,
} from '../models/TeacherProfile.model';
import UserModel, { UserDocument } from '../models/User.model';
import { AuthenticatedUser } from '../types/auth.types';
import { PaginatedResult, RequestAuditContext } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';
import { auditService } from './audit.service';
import { createManagedUserAccount } from './userAccount.service';

interface TeacherListQuery {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  designation?: string;
  userId?: string;
}

interface TeacherLoginPayload {
  fullName: string;
  email: string;
  password: string;
  isActive?: boolean;
}

interface TeacherProfilePayload {
  userId?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  subjectsTaught?: string[];
  assignedClassGroups?: string[];
  createLoginAccount?: boolean;
  login?: TeacherLoginPayload;
}

const dedupeIds = (ids: string[] | undefined): string[] | undefined => {
  if (!ids) {
    return undefined;
  }

  return [...new Set(ids)];
};

const ensureTeacherUserExists = async (userId: string): Promise<void> => {
  const user = await UserModel.findById(userId)
    .select('_id role isActive')
    .lean();

  if (!user) {
    throw new AppError('User not found.', HTTP_STATUS.NOT_FOUND);
  }

  if (!user.isActive) {
    throw new AppError('Selected user is inactive.', HTTP_STATUS.BAD_REQUEST);
  }

  if (user.role !== UserRole.TEACHER) {
    throw new AppError(
      'Teacher profile can only be linked to a user with teacher role.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
};

const ensureReferenceIdsExist = async (
  ids: string[] | undefined,
  existsFn: (values: string[]) => Promise<number>,
  errorMessage: string,
): Promise<void> => {
  if (!ids || ids.length === 0) {
    return;
  }

  const uniqueIds = [...new Set(ids)];
  const existingCount = await existsFn(uniqueIds);

  if (existingCount !== uniqueIds.length) {
    throw new AppError(errorMessage, HTTP_STATUS.BAD_REQUEST);
  }
};

const normalizeTeacherProfilePayload = (payload: TeacherProfilePayload) => {
  const normalizedLogin = payload.login
    ? {
        fullName: payload.login.fullName.trim(),
        email: payload.login.email.trim().toLowerCase(),
        password: payload.login.password,
        isActive: payload.login.isActive,
      }
    : undefined;

  return {
    ...payload,
    employeeId: payload.employeeId?.trim().toUpperCase(),
    department: payload.department?.trim(),
    designation: payload.designation?.trim(),
    subjectsTaught: dedupeIds(payload.subjectsTaught),
    assignedClassGroups: dedupeIds(payload.assignedClassGroups),
    createLoginAccount: payload.createLoginAccount === true,
    login: normalizedLogin,
  };
};

const assertTeacherProfileDuplicates = async (
  payload: {
    employeeId?: string;
    userId?: string;
  },
  excludeId?: string,
): Promise<void> => {
  if (payload.employeeId) {
    const existingProfile = await TeacherProfileModel.findOne({
      employeeId: payload.employeeId,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')
      .lean();

    if (existingProfile) {
      throw new AppError(
        'A teacher profile with this employee id already exists.',
        HTTP_STATUS.CONFLICT,
      );
    }
  }

  if (payload.userId) {
    const existingProfile = await TeacherProfileModel.findOne({
      userId: payload.userId,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')
      .lean();

    if (existingProfile) {
      throw new AppError(
        'A teacher profile for this user already exists.',
        HTTP_STATUS.CONFLICT,
      );
    }
  }
};

const getTeacherProfileOrThrow = async (id: string) => {
  const teacherProfile = await TeacherProfileModel.findById(id);

  if (!teacherProfile) {
    throw new AppError('Teacher profile not found.', HTTP_STATUS.NOT_FOUND);
  }

  return teacherProfile;
};

const deleteUserForRollback = async (user: UserDocument | null): Promise<void> => {
  if (!user) {
    return;
  }

  try {
    await user.deleteOne();
  } catch {
    // Best-effort rollback when the profile write fails after login creation.
  }
};

export const teacherService = {
  listTeacherProfiles: async (
    query: TeacherListQuery,
  ): Promise<PaginatedResult<unknown>> => {
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);

    const filter: FilterQuery<TeacherProfile> = {};

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { employeeId: searchRegex },
        { department: searchRegex },
        { designation: searchRegex },
      ];
    }

    if (query.department) {
      filter.department = new RegExp(`^${query.department}$`, 'i');
    }

    if (query.designation) {
      filter.designation = new RegExp(`^${query.designation}$`, 'i');
    }

    if (query.userId) {
      filter.userId = query.userId;
    }

    const [teacherProfiles, totalItems] = await Promise.all([
      TeacherProfileModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TeacherProfileModel.countDocuments(filter),
    ]);

    return {
      items: teacherProfiles.map((teacherProfile) => teacherProfile.toJSON()),
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  getTeacherProfileById: async (id: string): Promise<unknown> => {
    const teacherProfile = await getTeacherProfileOrThrow(id);
    return teacherProfile.toJSON();
  },

  createTeacherProfile: async (
    payload: TeacherProfilePayload,
    currentUser: AuthenticatedUser,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const normalizedPayload = normalizeTeacherProfilePayload(payload);
    let createdUser: UserDocument | null = null;

    await assertTeacherProfileDuplicates({
      employeeId: normalizedPayload.employeeId,
      userId: normalizedPayload.userId,
    });
    await ensureReferenceIdsExist(
      normalizedPayload.subjectsTaught,
      async (ids) => SubjectModel.countDocuments({ _id: { $in: ids } }),
      'One or more subject ids are invalid.',
    );
    await ensureReferenceIdsExist(
      normalizedPayload.assignedClassGroups,
      async (ids) => ClassGroupModel.countDocuments({ _id: { $in: ids } }),
      'One or more class group ids are invalid.',
    );

    try {
      let teacherUserId = normalizedPayload.userId;

      if (teacherUserId) {
        await ensureTeacherUserExists(teacherUserId);
      }

      if (normalizedPayload.createLoginAccount) {
        if (!normalizedPayload.login) {
          throw new AppError(
            'Login details are required when createLoginAccount is true.',
            HTTP_STATUS.BAD_REQUEST,
          );
        }

        createdUser = await createManagedUserAccount(
          {
            fullName: normalizedPayload.login!.fullName,
            email: normalizedPayload.login!.email,
            password: normalizedPayload.login!.password,
            role: UserRole.TEACHER,
            isActive: normalizedPayload.login?.isActive,
          },
          {
            currentUser,
            auditContext,
          },
        );
        teacherUserId = createdUser.id;
      }

      if (!teacherUserId) {
        throw new AppError(
          'Teacher profile must be linked to a teacher user.',
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const teacherProfile = await TeacherProfileModel.create({
        userId: teacherUserId,
        employeeId: normalizedPayload.employeeId,
        department: normalizedPayload.department,
        designation: normalizedPayload.designation,
        subjectsTaught: normalizedPayload.subjectsTaught ?? [],
        assignedClassGroups: normalizedPayload.assignedClassGroups ?? [],
      });

      await auditService.logAction({
        ...auditContext,
        action: 'teacher.create',
        entityType: 'teacherProfile',
        entityId: teacherProfile.id,
        metadata: {
          employeeId: teacherProfile.employeeId,
          userId: String(teacherProfile.userId),
          subjectCount: teacherProfile.subjectsTaught.length,
          assignedClassGroupCount: teacherProfile.assignedClassGroups.length,
          loginAccountCreated: Boolean(createdUser),
        },
      });

      return teacherProfile.toJSON();
    } catch (error) {
      await deleteUserForRollback(createdUser);
      throw error;
    }
  },

  updateTeacherProfile: async (
    id: string,
    payload: TeacherProfilePayload,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const teacherProfile = await getTeacherProfileOrThrow(id);
    const normalizedPayload = normalizeTeacherProfilePayload(payload);
    const updatedFieldNames = Object.keys(payload).filter((fieldName) => {
      const value = payload[fieldName as keyof TeacherProfilePayload];
      return value !== undefined;
    });

    if (normalizedPayload.userId) {
      await ensureTeacherUserExists(normalizedPayload.userId);
    }

    await assertTeacherProfileDuplicates(
      {
        employeeId: normalizedPayload.employeeId,
        userId: normalizedPayload.userId,
      },
      id,
    );
    await ensureReferenceIdsExist(
      normalizedPayload.subjectsTaught,
      async (ids) => SubjectModel.countDocuments({ _id: { $in: ids } }),
      'One or more subject ids are invalid.',
    );
    await ensureReferenceIdsExist(
      normalizedPayload.assignedClassGroups,
      async (ids) => ClassGroupModel.countDocuments({ _id: { $in: ids } }),
      'One or more class group ids are invalid.',
    );

    const {
      createLoginAccount: _createLoginAccount,
      login: _login,
      ...profileUpdates
    } = normalizedPayload;

    Object.assign(teacherProfile, profileUpdates);
    await teacherProfile.save();
    await auditService.logAction({
      ...auditContext,
      action: 'teacher.update',
      entityType: 'teacherProfile',
      entityId: teacherProfile.id,
      metadata: {
        updatedFields: updatedFieldNames,
        employeeId: teacherProfile.employeeId,
        userId: String(teacherProfile.userId),
      },
    });

    return teacherProfile.toJSON();
  },

  deleteTeacherProfile: async (
    id: string,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const teacherProfile = await getTeacherProfileOrThrow(id);
    await teacherProfile.deleteOne();
    await auditService.logAction({
      ...auditContext,
      action: 'teacher.delete',
      entityType: 'teacherProfile',
      entityId: teacherProfile.id,
      metadata: {
        employeeId: teacherProfile.employeeId,
        userId: String(teacherProfile.userId),
      },
    });
    return teacherProfile.toJSON();
  },
};
