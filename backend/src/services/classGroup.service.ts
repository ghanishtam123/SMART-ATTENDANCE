import { FilterQuery } from 'mongoose';

import { HTTP_STATUS } from '../constants/http';
import ClassGroupModel, { ClassGroup } from '../models/ClassGroup.model';
import { PaginatedResult } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';

interface ClassGroupListQuery {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  semester?: number;
  academicYear?: string;
  isActive?: boolean;
}

interface ClassGroupPayload {
  name?: string;
  code?: string;
  department?: string;
  semester?: number;
  section?: string;
  academicYear?: string;
  isActive?: boolean;
}

const normalizeClassGroupPayload = (payload: ClassGroupPayload) => {
  return {
    ...payload,
    name: payload.name?.trim(),
    code: payload.code?.trim().toUpperCase(),
    department: payload.department?.trim(),
    section: payload.section?.trim().toUpperCase(),
    academicYear: payload.academicYear?.trim(),
  };
};

const assertClassGroupDuplicates = async (
  payload: ReturnType<typeof normalizeClassGroupPayload>,
  excludeId?: string,
): Promise<void> => {
  if (!payload.code) {
    return;
  }

  const existingClassGroup = await ClassGroupModel.findOne({
    code: payload.code,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select('_id')
    .lean();

  if (existingClassGroup) {
    throw new AppError(
      'A class group with this code already exists.',
      HTTP_STATUS.CONFLICT,
    );
  }
};

const getClassGroupOrThrow = async (id: string) => {
  const classGroup = await ClassGroupModel.findById(id);

  if (!classGroup) {
    throw new AppError('Class group not found.', HTTP_STATUS.NOT_FOUND);
  }

  return classGroup;
};

export const classGroupService = {
  listClassGroups: async (
    query: ClassGroupListQuery,
  ): Promise<PaginatedResult<unknown>> => {
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);

    const filter: FilterQuery<ClassGroup> = {};

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { department: searchRegex },
        { section: searchRegex },
        { academicYear: searchRegex },
      ];
    }

    if (query.department) {
      filter.department = new RegExp(`^${query.department}$`, 'i');
    }

    if (query.semester !== undefined) {
      filter.semester = query.semester;
    }

    if (query.academicYear) {
      filter.academicYear = new RegExp(`^${query.academicYear}$`, 'i');
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    const [classGroups, totalItems] = await Promise.all([
      ClassGroupModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ClassGroupModel.countDocuments(filter),
    ]);

    return {
      items: classGroups.map((classGroup) => classGroup.toJSON()),
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  getClassGroupById: async (id: string): Promise<unknown> => {
    const classGroup = await getClassGroupOrThrow(id);
    return classGroup.toJSON();
  },

  createClassGroup: async (payload: ClassGroupPayload): Promise<unknown> => {
    const normalizedPayload = normalizeClassGroupPayload(payload);
    await assertClassGroupDuplicates(normalizedPayload);

    const classGroup = await ClassGroupModel.create({
      name: normalizedPayload.name,
      code: normalizedPayload.code,
      department: normalizedPayload.department,
      semester: normalizedPayload.semester,
      section: normalizedPayload.section,
      academicYear: normalizedPayload.academicYear,
      isActive: normalizedPayload.isActive ?? true,
    });

    return classGroup.toJSON();
  },

  updateClassGroup: async (id: string, payload: ClassGroupPayload): Promise<unknown> => {
    const classGroup = await getClassGroupOrThrow(id);
    const normalizedPayload = normalizeClassGroupPayload(payload);

    await assertClassGroupDuplicates(normalizedPayload, id);

    for (const [key, value] of Object.entries(normalizedPayload)) {
      if (value !== undefined) {
        (classGroup as unknown as Record<string, unknown>)[key] = value;
      }
    }
    await classGroup.save();

    return classGroup.toJSON();
  },

  deleteClassGroup: async (id: string): Promise<unknown> => {
    const classGroup = await getClassGroupOrThrow(id);
    await classGroup.deleteOne();
    return classGroup.toJSON();
  },
};
