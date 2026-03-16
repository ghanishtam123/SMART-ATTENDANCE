import { FilterQuery } from 'mongoose';

import { HTTP_STATUS } from '../constants/http';
import ClassGroupModel from '../models/ClassGroup.model';
import SubjectModel, { Subject } from '../models/Subject.model';
import TeacherProfileModel from '../models/TeacherProfile.model';
import { PaginatedResult } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';

interface SubjectListQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  assignedTeacherId?: string;
  classGroupId?: string;
}

interface SubjectPayload {
  name?: string;
  code?: string;
  description?: string;
  creditHours?: number | null;
  assignedTeacherIds?: string[];
  classGroupIds?: string[];
  isActive?: boolean;
}

const dedupeIds = (ids: string[] | undefined): string[] | undefined => {
  if (!ids) {
    return undefined;
  }

  return [...new Set(ids)];
};

const normalizeSubjectPayload = (payload: SubjectPayload) => {
  return {
    ...payload,
    name: payload.name?.trim(),
    code: payload.code?.trim().toUpperCase(),
    description: payload.description?.trim(),
    assignedTeacherIds: dedupeIds(payload.assignedTeacherIds),
    classGroupIds: dedupeIds(payload.classGroupIds),
  };
};

const ensureReferenceIdsExist = async (
  ids: string[] | undefined,
  countFn: (values: string[]) => Promise<number>,
  message: string,
): Promise<void> => {
  if (!ids || ids.length === 0) {
    return;
  }

  const uniqueIds = [...new Set(ids)];
  const existingCount = await countFn(uniqueIds);

  if (existingCount !== uniqueIds.length) {
    throw new AppError(message, HTTP_STATUS.BAD_REQUEST);
  }
};

const assertSubjectDuplicates = async (
  payload: ReturnType<typeof normalizeSubjectPayload>,
  excludeId?: string,
): Promise<void> => {
  if (!payload.code) {
    return;
  }

  const existingSubject = await SubjectModel.findOne({
    code: payload.code,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select('_id')
    .lean();

  if (existingSubject) {
    throw new AppError(
      'A subject with this code already exists.',
      HTTP_STATUS.CONFLICT,
    );
  }
};

const getSubjectOrThrow = async (id: string) => {
  const subject = await SubjectModel.findById(id);

  if (!subject) {
    throw new AppError('Subject not found.', HTTP_STATUS.NOT_FOUND);
  }

  return subject;
};

export const subjectService = {
  listSubjects: async (
    query: SubjectListQuery,
  ): Promise<PaginatedResult<unknown>> => {
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);

    const filter: FilterQuery<Subject> = {};

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { description: searchRegex },
      ];
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (query.assignedTeacherId) {
      filter.assignedTeacherIds = query.assignedTeacherId;
    }

    if (query.classGroupId) {
      filter.classGroupIds = query.classGroupId;
    }

    const [subjects, totalItems] = await Promise.all([
      SubjectModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SubjectModel.countDocuments(filter),
    ]);

    return {
      items: subjects.map((subject) => subject.toJSON()),
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  getSubjectById: async (id: string): Promise<unknown> => {
    const subject = await getSubjectOrThrow(id);
    return subject.toJSON();
  },

  createSubject: async (payload: SubjectPayload): Promise<unknown> => {
    const normalizedPayload = normalizeSubjectPayload(payload);

    await assertSubjectDuplicates(normalizedPayload);
    await ensureReferenceIdsExist(
      normalizedPayload.assignedTeacherIds,
      async (ids) => TeacherProfileModel.countDocuments({ _id: { $in: ids } }),
      'One or more assigned teacher ids are invalid.',
    );
    await ensureReferenceIdsExist(
      normalizedPayload.classGroupIds,
      async (ids) => ClassGroupModel.countDocuments({ _id: { $in: ids } }),
      'One or more class group ids are invalid.',
    );

    const subject = await SubjectModel.create({
      name: normalizedPayload.name,
      code: normalizedPayload.code,
      description: normalizedPayload.description,
      creditHours: normalizedPayload.creditHours ?? null,
      assignedTeacherIds: normalizedPayload.assignedTeacherIds ?? [],
      classGroupIds: normalizedPayload.classGroupIds ?? [],
      isActive: normalizedPayload.isActive ?? true,
    });

    return subject.toJSON();
  },

  updateSubject: async (id: string, payload: SubjectPayload): Promise<unknown> => {
    const subject = await getSubjectOrThrow(id);
    const normalizedPayload = normalizeSubjectPayload(payload);

    await assertSubjectDuplicates(normalizedPayload, id);
    await ensureReferenceIdsExist(
      normalizedPayload.assignedTeacherIds,
      async (ids) => TeacherProfileModel.countDocuments({ _id: { $in: ids } }),
      'One or more assigned teacher ids are invalid.',
    );
    await ensureReferenceIdsExist(
      normalizedPayload.classGroupIds,
      async (ids) => ClassGroupModel.countDocuments({ _id: { $in: ids } }),
      'One or more class group ids are invalid.',
    );

    Object.assign(subject, normalizedPayload);
    await subject.save();

    return subject.toJSON();
  },

  deleteSubject: async (id: string): Promise<unknown> => {
    const subject = await getSubjectOrThrow(id);
    await subject.deleteOne();
    return subject.toJSON();
  },
};
