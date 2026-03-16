import { FilterQuery } from 'mongoose';

import { HTTP_STATUS } from '../constants/http';
import { StudentStatus } from '../constants/student';
import ClassGroupModel from '../models/ClassGroup.model';
import StudentModel, { Student } from '../models/Student.model';
import { PaginatedResult, RequestAuditContext } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';
import { auditService } from './audit.service';

interface StudentListQuery {
  page?: number;
  limit?: number;
  search?: string;
  classGroupId?: string;
  status?: StudentStatus;
  hasEmail?: boolean;
}

interface StudentPayload {
  firstName?: string;
  lastName?: string;
  rollNumber?: string;
  email?: string | null;
  phone?: string | null;
  gender?: Student['gender'];
  classGroupId?: string;
  status?: StudentStatus;
  faceProfileId?: string | null;
}

const ensureClassGroupExists = async (classGroupId: string): Promise<void> => {
  const classGroup = await ClassGroupModel.exists({ _id: classGroupId });

  if (!classGroup) {
    throw new AppError('Class group not found.', HTTP_STATUS.NOT_FOUND);
  }
};

const normalizeStudentPayload = (payload: StudentPayload) => {
  return {
    ...payload,
    firstName: payload.firstName?.trim(),
    lastName: payload.lastName?.trim(),
    rollNumber: payload.rollNumber?.trim().toUpperCase(),
    email:
      payload.email === undefined
        ? undefined
        : payload.email === null || payload.email.trim() === ''
          ? null
          : payload.email.trim().toLowerCase(),
    phone:
      payload.phone === undefined
        ? undefined
        : payload.phone === null || payload.phone.trim() === ''
          ? null
          : payload.phone.trim(),
    faceProfileId:
      payload.faceProfileId === undefined || payload.faceProfileId === ''
        ? undefined
        : payload.faceProfileId,
  };
};

const assertStudentDuplicates = async (
  payload: ReturnType<typeof normalizeStudentPayload>,
  excludeId?: string,
): Promise<void> => {
  if (payload.rollNumber) {
    const existingStudent = await StudentModel.findOne({
      rollNumber: payload.rollNumber,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')
      .lean();

    if (existingStudent) {
      throw new AppError(
        'A student with this roll number already exists.',
        HTTP_STATUS.CONFLICT,
      );
    }
  }

  if (payload.email) {
    const existingStudent = await StudentModel.findOne({
      email: payload.email,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')
      .lean();

    if (existingStudent) {
      throw new AppError(
        'A student with this email already exists.',
        HTTP_STATUS.CONFLICT,
      );
    }
  }
};

const getStudentOrThrow = async (id: string) => {
  const student = await StudentModel.findById(id);

  if (!student) {
    throw new AppError('Student not found.', HTTP_STATUS.NOT_FOUND);
  }

  return student;
};

export const studentService = {
  listStudents: async (
    query: StudentListQuery,
  ): Promise<PaginatedResult<unknown>> => {
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);

    const filter: FilterQuery<Student> = {};

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { rollNumber: searchRegex },
        { email: searchRegex },
      ];
    }

    if (query.classGroupId) {
      filter.classGroupId = query.classGroupId;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.hasEmail === true) {
      filter.email = { $ne: null };
    }

    if (query.hasEmail === false) {
      filter.email = null;
    }

    const [students, totalItems] = await Promise.all([
      StudentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StudentModel.countDocuments(filter),
    ]);

    return {
      items: students.map((student) => student.toJSON()),
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  getStudentById: async (id: string): Promise<unknown> => {
    const student = await getStudentOrThrow(id);
    return student.toJSON();
  },

  createStudent: async (
    payload: StudentPayload,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const normalizedPayload = normalizeStudentPayload(payload);

    await ensureClassGroupExists(normalizedPayload.classGroupId!);
    await assertStudentDuplicates(normalizedPayload);

    const student = await StudentModel.create({
      firstName: normalizedPayload.firstName,
      lastName: normalizedPayload.lastName,
      rollNumber: normalizedPayload.rollNumber,
      email: normalizedPayload.email ?? null,
      phone: normalizedPayload.phone ?? null,
      gender: normalizedPayload.gender ?? null,
      classGroupId: normalizedPayload.classGroupId,
      status: normalizedPayload.status ?? StudentStatus.ACTIVE,
      faceProfileId: normalizedPayload.faceProfileId ?? null,
    });
    await auditService.logAction({
      ...auditContext,
      action: 'student.create',
      entityType: 'student',
      entityId: student.id,
      metadata: {
        rollNumber: student.rollNumber,
        classGroupId: String(student.classGroupId),
        status: student.status,
      },
    });

    return student.toJSON();
  },

  updateStudent: async (
    id: string,
    payload: StudentPayload,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const student = await getStudentOrThrow(id);
    const normalizedPayload = normalizeStudentPayload(payload);
    const updatedFieldNames = Object.keys(payload).filter((fieldName) => {
      const value = payload[fieldName as keyof StudentPayload];
      return value !== undefined;
    });

    if (normalizedPayload.classGroupId) {
      await ensureClassGroupExists(normalizedPayload.classGroupId);
    }

    await assertStudentDuplicates(normalizedPayload, id);

    Object.assign(student, normalizedPayload);
    await student.save();
    await auditService.logAction({
      ...auditContext,
      action: 'student.update',
      entityType: 'student',
      entityId: student.id,
      metadata: {
        updatedFields: updatedFieldNames,
        rollNumber: student.rollNumber,
        classGroupId: String(student.classGroupId),
        status: student.status,
      },
    });

    return student.toJSON();
  },

  deleteStudent: async (id: string): Promise<unknown> => {
    const student = await getStudentOrThrow(id);
    await student.deleteOne();
    return student.toJSON();
  },
};
