import { FilterQuery } from 'mongoose';

import { HTTP_STATUS } from '../constants/http';
import ClassroomModel, { Classroom } from '../models/Classroom.model';
import { PaginatedResult } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';

interface ClassroomListQuery {
  page?: number;
  limit?: number;
  search?: string;
  building?: string;
  isActive?: boolean;
}

interface ClassroomPayload {
  name?: string;
  code?: string;
  building?: string;
  floor?: string;
  capacity?: number;
  cameraIds?: string[];
  isActive?: boolean;
}

const normalizeClassroomPayload = (payload: ClassroomPayload) => {
  return {
    ...payload,
    name: payload.name?.trim(),
    code: payload.code?.trim().toUpperCase(),
    building: payload.building?.trim(),
    floor: payload.floor?.trim(),
    cameraIds: payload.cameraIds?.map((cameraId) => cameraId.trim()),
  };
};

const assertClassroomDuplicates = async (
  payload: ReturnType<typeof normalizeClassroomPayload>,
  excludeId?: string,
): Promise<void> => {
  if (!payload.code) {
    return;
  }

  const existingClassroom = await ClassroomModel.findOne({
    code: payload.code,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select('_id')
    .lean();

  if (existingClassroom) {
    throw new AppError(
      'A classroom with this code already exists.',
      HTTP_STATUS.CONFLICT,
    );
  }
};

const getClassroomOrThrow = async (id: string) => {
  const classroom = await ClassroomModel.findById(id);

  if (!classroom) {
    throw new AppError('Classroom not found.', HTTP_STATUS.NOT_FOUND);
  }

  return classroom;
};

export const classroomService = {
  listClassrooms: async (
    query: ClassroomListQuery,
  ): Promise<PaginatedResult<unknown>> => {
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);

    const filter: FilterQuery<Classroom> = {};

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { building: searchRegex },
        { floor: searchRegex },
      ];
    }

    if (query.building) {
      filter.building = new RegExp(`^${query.building}$`, 'i');
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    const [classrooms, totalItems] = await Promise.all([
      ClassroomModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ClassroomModel.countDocuments(filter),
    ]);

    return {
      items: classrooms.map((classroom) => classroom.toJSON()),
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  getClassroomById: async (id: string): Promise<unknown> => {
    const classroom = await getClassroomOrThrow(id);
    return classroom.toJSON();
  },

  createClassroom: async (payload: ClassroomPayload): Promise<unknown> => {
    const normalizedPayload = normalizeClassroomPayload(payload);
    await assertClassroomDuplicates(normalizedPayload);

    const classroom = await ClassroomModel.create({
      name: normalizedPayload.name,
      code: normalizedPayload.code,
      building: normalizedPayload.building,
      floor: normalizedPayload.floor,
      capacity: normalizedPayload.capacity,
      cameraIds: normalizedPayload.cameraIds ?? [],
      isActive: normalizedPayload.isActive ?? true,
    });

    return classroom.toJSON();
  },

  updateClassroom: async (id: string, payload: ClassroomPayload): Promise<unknown> => {
    const classroom = await getClassroomOrThrow(id);
    const normalizedPayload = normalizeClassroomPayload(payload);

    await assertClassroomDuplicates(normalizedPayload, id);

    Object.assign(classroom, normalizedPayload);
    await classroom.save();

    return classroom.toJSON();
  },

  deleteClassroom: async (id: string): Promise<unknown> => {
    const classroom = await getClassroomOrThrow(id);
    await classroom.deleteOne();
    return classroom.toJSON();
  },
};
