import fs from 'node:fs/promises';
import path from 'node:path';

import { FilterQuery } from 'mongoose';

import { FaceRegistrationStatus } from '../constants/faceProfile';
import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import { StudentStatus } from '../constants/student';
import ClassGroupModel from '../models/ClassGroup.model';
import StudentModel, { Student } from '../models/Student.model';
import UserModel, { UserDocument } from '../models/User.model';
import { AuthenticatedUser } from '../types/auth.types';
import { PaginatedResult, RequestAuditContext } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';
import { auditService } from './audit.service';
import { faceProfileService } from './faceProfile.service';
import { createManagedUserAccount } from './userAccount.service';

interface StudentListQuery {
  page?: number;
  limit?: number;
  search?: string;
  classGroupId?: string;
  status?: StudentStatus;
  hasEmail?: boolean;
}

interface StudentLoginPayload {
  email: string;
  password: string;
  isActive?: boolean;
}

interface StudentPayload {
  firstName?: string;
  lastName?: string;
  rollNumber?: string;
  email?: string | null;
  phone?: string | null;
  gender?: Student['gender'];
  userId?: string | null;
  classGroupId?: string;
  status?: StudentStatus;
  faceProfileId?: string | null;
  createLoginAccount?: boolean;
  login?: StudentLoginPayload;
}

interface LinkedStudentUser {
  id: string;
  email: string;
}

interface StudentFaceImagesPayload {
  center: string;
  left: string;
  right: string;
}

interface StudentFaceImagesResult {
  studentId: string;
  storageDir: string;
  images: {
    center: string | null;
    left: string | null;
    right: string | null;
  };
  faceProfileUpdated: boolean;
  updatedAt: string | null;
}

const FACE_IMAGE_POSES = ['center', 'left', 'right'] as const;
const FACE_IMAGE_MAX_BYTES = 1024 * 1024;

const getAiServiceStudentDir = (studentId: string): string =>
  path.resolve(process.cwd(), '..', 'ai-service', 'data', 'students', studentId);

const decodeJpegDataUrl = (value: string, pose: string): Buffer => {
  const trimmed = value.trim();
  const match = trimmed.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);

  if (!match) {
    throw new AppError(
      `Invalid ${pose} face image format.`,
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  const buffer = Buffer.from(match[1], 'base64');

  if (!buffer.length) {
    throw new AppError(
      `${pose} face image is empty.`,
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  if (buffer.length > FACE_IMAGE_MAX_BYTES) {
    throw new AppError(
      `${pose} face image exceeds 1MB size limit.`,
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  return buffer;
};

const ensureClassGroupExists = async (classGroupId: string): Promise<void> => {
  const classGroup = await ClassGroupModel.exists({ _id: classGroupId });

  if (!classGroup) {
    throw new AppError('Class group not found.', HTTP_STATUS.NOT_FOUND);
  }
};

const normalizeStudentPayload = (payload: StudentPayload) => {
  const normalizedLogin = payload.login
    ? {
        email: payload.login.email.trim().toLowerCase(),
        password: payload.login.password,
        isActive: payload.login.isActive,
      }
    : undefined;

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
    userId:
      payload.userId === undefined || payload.userId === ''
        ? undefined
        : payload.userId,
    faceProfileId:
      payload.faceProfileId === undefined || payload.faceProfileId === ''
        ? undefined
        : payload.faceProfileId,
    createLoginAccount: payload.createLoginAccount === true,
    login: normalizedLogin,
  };
};

const buildStudentFullName = (
  firstName?: string,
  lastName?: string,
): string => {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
};

const getStudentLinkedUser = async (userId: string): Promise<LinkedStudentUser> => {
  const user = await UserModel.findById(userId)
    .select('_id role email')
    .lean();

  if (!user) {
    throw new AppError('Linked user not found.', HTTP_STATUS.NOT_FOUND);
  }

  if (user.role !== UserRole.STUDENT) {
    throw new AppError(
      'Student records can only be linked to a user with student role.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  return {
    id: String(user._id),
    email: user.email,
  };
};

const assertStudentDuplicates = async (
  payload: Pick<Student, 'rollNumber' | 'email'> & { userId?: string | null },
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

  if (payload.userId) {
    const existingStudent = await StudentModel.findOne({
      userId: payload.userId,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')
      .lean();

    if (existingStudent) {
      throw new AppError(
        'A student is already linked to this user.',
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

const assignStudentField = (
  student: Awaited<ReturnType<typeof getStudentOrThrow>>,
  key: keyof Student,
  value: unknown,
) => {
  if (value !== undefined) {
    student.set(key, value);
  }
};

const assertStudentEmailMatchesLinkedUser = (
  studentEmail: string | null | undefined,
  linkedUser: LinkedStudentUser | null,
) => {
  if (
    linkedUser &&
    studentEmail !== undefined &&
    studentEmail !== null &&
    studentEmail !== linkedUser.email
  ) {
    throw new AppError(
      'Student email must match the linked student user email.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
};

const resolveEffectiveLinkedStudentUser = async (
  student: Awaited<ReturnType<typeof getStudentOrThrow>>,
  payload: ReturnType<typeof normalizeStudentPayload>,
): Promise<LinkedStudentUser | null> => {
  if (payload.userId === null) {
    return null;
  }

  if (payload.userId) {
    return getStudentLinkedUser(payload.userId);
  }

  if (student.userId) {
    return getStudentLinkedUser(String(student.userId));
  }

  return null;
};

const deleteUserForRollback = async (user: UserDocument | null): Promise<void> => {
  if (!user) {
    return;
  }

  try {
    await user.deleteOne();
  } catch {
    // Best-effort rollback when the domain record fails after login creation.
  }
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
    currentUser: AuthenticatedUser,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const normalizedPayload = normalizeStudentPayload(payload);
    const derivedStudentEmail =
      normalizedPayload.login?.email ?? normalizedPayload.email ?? null;
    let createdUser: UserDocument | null = null;

    await ensureClassGroupExists(normalizedPayload.classGroupId!);
    await assertStudentDuplicates({
      rollNumber: normalizedPayload.rollNumber!,
      email: derivedStudentEmail,
      userId: normalizedPayload.userId,
    });

    try {
      let linkedUser = normalizedPayload.userId
        ? await getStudentLinkedUser(normalizedPayload.userId)
        : null;

      if (normalizedPayload.createLoginAccount) {
        if (!normalizedPayload.login) {
          throw new AppError(
            'Login details are required when createLoginAccount is true.',
            HTTP_STATUS.BAD_REQUEST,
          );
        }

        createdUser = await createManagedUserAccount(
          {
            fullName: buildStudentFullName(
              normalizedPayload.firstName,
              normalizedPayload.lastName,
            ),
            email: normalizedPayload.login!.email,
            password: normalizedPayload.login!.password,
            role: UserRole.STUDENT,
            isActive: normalizedPayload.login?.isActive,
          },
          {
            currentUser,
            auditContext,
          },
        );

        linkedUser = {
          id: createdUser.id,
          email: createdUser.email,
        };
      }

      assertStudentEmailMatchesLinkedUser(normalizedPayload.email, linkedUser);

      const student = await StudentModel.create({
        firstName: normalizedPayload.firstName,
        lastName: normalizedPayload.lastName,
        rollNumber: normalizedPayload.rollNumber,
        email: linkedUser?.email ?? normalizedPayload.email ?? null,
        phone: normalizedPayload.phone ?? null,
        gender: normalizedPayload.gender ?? null,
        userId: linkedUser?.id ?? normalizedPayload.userId ?? null,
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
          userId: student.userId ? String(student.userId) : null,
          loginAccountCreated: Boolean(createdUser),
        },
      });

      return student.toJSON();
    } catch (error) {
      await deleteUserForRollback(createdUser);
      throw error;
    }
  },

  updateStudent: async (
    id: string,
    payload: StudentPayload,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const student = await getStudentOrThrow(id);
    const normalizedPayload = normalizeStudentPayload(payload);
    const effectiveLinkedUser = await resolveEffectiveLinkedStudentUser(
      student,
      normalizedPayload,
    );
    const updatedFieldNames = Object.keys(payload).filter((fieldName) => {
      const value = payload[fieldName as keyof StudentPayload];
      return value !== undefined;
    });

    if (normalizedPayload.classGroupId) {
      await ensureClassGroupExists(normalizedPayload.classGroupId);
    }

    assertStudentEmailMatchesLinkedUser(
      normalizedPayload.email,
      effectiveLinkedUser,
    );

    await assertStudentDuplicates(
      {
        rollNumber: normalizedPayload.rollNumber ?? student.rollNumber,
        email: effectiveLinkedUser?.email ?? normalizedPayload.email ?? student.email,
        userId:
          normalizedPayload.userId === null
            ? null
            : effectiveLinkedUser?.id ?? normalizedPayload.userId,
      },
      id,
    );

    assignStudentField(student, 'firstName', normalizedPayload.firstName);
    assignStudentField(student, 'lastName', normalizedPayload.lastName);
    assignStudentField(student, 'rollNumber', normalizedPayload.rollNumber);
    assignStudentField(
      student,
      'email',
      effectiveLinkedUser?.email ?? normalizedPayload.email,
    );
    assignStudentField(student, 'phone', normalizedPayload.phone);
    assignStudentField(student, 'gender', normalizedPayload.gender);
    assignStudentField(student, 'userId', normalizedPayload.userId);
    assignStudentField(student, 'classGroupId', normalizedPayload.classGroupId);
    assignStudentField(student, 'status', normalizedPayload.status);
    assignStudentField(student, 'faceProfileId', normalizedPayload.faceProfileId);
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
        userId: student.userId ? String(student.userId) : null,
      },
    });

    return student.toJSON();
  },

  deleteStudent: async (id: string): Promise<unknown> => {
    const student = await getStudentOrThrow(id);
    await student.deleteOne();
    return student.toJSON();
  },

  saveStudentFaceImages: async (
    id: string,
    payload: StudentFaceImagesPayload,
    auditContext?: RequestAuditContext,
  ): Promise<StudentFaceImagesResult> => {
    const student = await getStudentOrThrow(id);
    const storageDir = getAiServiceStudentDir(id);
    const now = new Date();
    const imagePayload: Record<(typeof FACE_IMAGE_POSES)[number], string> = {
      center: payload.center,
      left: payload.left,
      right: payload.right,
    };

    await fs.mkdir(storageDir, { recursive: true });

    await Promise.all(
      FACE_IMAGE_POSES.map(async (pose) => {
        const imageBuffer = decodeJpegDataUrl(imagePayload[pose], pose);
        await fs.writeFile(path.join(storageDir, `${pose}.jpg`), imageBuffer);
      }),
    );

    await faceProfileService.upsertFaceProfile(
      {
        studentId: id,
        embeddingVersion: 'manual-v1',
        embeddingCount: FACE_IMAGE_POSES.length,
        registrationStatus: FaceRegistrationStatus.REGISTERED,
        registeredAt: now,
        lastUpdatedAt: now,
        notes: 'Registered via student face-images upload.',
      },
      auditContext,
    );

    await auditService.logAction({
      ...auditContext,
      action: 'student.face_images.upload',
      entityType: 'student',
      entityId: student.id,
      metadata: {
        poses: FACE_IMAGE_POSES,
        storageDir,
      },
    });

    return {
      studentId: student.id,
      storageDir,
      images: {
        center: path.join(storageDir, 'center.jpg'),
        left: path.join(storageDir, 'left.jpg'),
        right: path.join(storageDir, 'right.jpg'),
      },
      faceProfileUpdated: true,
      updatedAt: now.toISOString(),
    };
  },

  getStudentFaceImages: async (id: string): Promise<StudentFaceImagesResult> => {
    const student = await getStudentOrThrow(id);
    const storageDir = getAiServiceStudentDir(id);

    const existing = await Promise.all(
      FACE_IMAGE_POSES.map(async (pose) => {
        const absolutePath = path.join(storageDir, `${pose}.jpg`);
        try {
          const stats = await fs.stat(absolutePath);
          return [pose, absolutePath, stats.mtime] as const;
        } catch {
          return [pose, null, null] as const;
        }
      }),
    );

    const images = Object.fromEntries(
      existing.map(([pose, absolutePath]) => [pose, absolutePath]),
    ) as StudentFaceImagesResult['images'];
    const hasAnyImage = Boolean(images.center || images.left || images.right);
    const latestMtime = existing
      .map(([, , mtime]) => mtime)
      .filter((mtime): mtime is Date => mtime instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const updatedAt = latestMtime ? latestMtime.toISOString() : null;

    return {
      studentId: student.id,
      storageDir,
      images,
      faceProfileUpdated: hasAnyImage,
      updatedAt,
    };
  },
};
