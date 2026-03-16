import { FilterQuery } from 'mongoose';

import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import ClassGroupModel from '../models/ClassGroup.model';
import SubjectModel from '../models/Subject.model';
import TeacherProfileModel, {
  TeacherProfile,
} from '../models/TeacherProfile.model';
import UserModel from '../models/User.model';
import { PaginatedResult } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';

interface TeacherListQuery {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  designation?: string;
  userId?: string;
}

interface TeacherProfilePayload {
  userId?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  subjectsTaught?: string[];
  assignedClassGroups?: string[];
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
  return {
    ...payload,
    employeeId: payload.employeeId?.trim().toUpperCase(),
    department: payload.department?.trim(),
    designation: payload.designation?.trim(),
    subjectsTaught: dedupeIds(payload.subjectsTaught),
    assignedClassGroups: dedupeIds(payload.assignedClassGroups),
  };
};

const assertTeacherProfileDuplicates = async (
  payload: ReturnType<typeof normalizeTeacherProfilePayload>,
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

  createTeacherProfile: async (payload: TeacherProfilePayload): Promise<unknown> => {
    const normalizedPayload = normalizeTeacherProfilePayload(payload);

    await ensureTeacherUserExists(normalizedPayload.userId!);
    await assertTeacherProfileDuplicates(normalizedPayload);
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

    const teacherProfile = await TeacherProfileModel.create({
      userId: normalizedPayload.userId,
      employeeId: normalizedPayload.employeeId,
      department: normalizedPayload.department,
      designation: normalizedPayload.designation,
      subjectsTaught: normalizedPayload.subjectsTaught ?? [],
      assignedClassGroups: normalizedPayload.assignedClassGroups ?? [],
    });

    return teacherProfile.toJSON();
  },

  updateTeacherProfile: async (
    id: string,
    payload: TeacherProfilePayload,
  ): Promise<unknown> => {
    const teacherProfile = await getTeacherProfileOrThrow(id);
    const normalizedPayload = normalizeTeacherProfilePayload(payload);

    if (normalizedPayload.userId) {
      await ensureTeacherUserExists(normalizedPayload.userId);
    }

    await assertTeacherProfileDuplicates(normalizedPayload, id);
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

    Object.assign(teacherProfile, normalizedPayload);
    await teacherProfile.save();

    return teacherProfile.toJSON();
  },

  deleteTeacherProfile: async (id: string): Promise<unknown> => {
    const teacherProfile = await getTeacherProfileOrThrow(id);
    await teacherProfile.deleteOne();
    return teacherProfile.toJSON();
  },
};
