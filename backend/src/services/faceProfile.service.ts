import { PipelineStage, Types } from 'mongoose';

import { HTTP_STATUS } from '../constants/http';
import { FaceRegistrationStatus } from '../constants/faceProfile';
import FaceProfileModel from '../models/FaceProfile.model';
import StudentModel from '../models/Student.model';
import { PaginatedResult, RequestAuditContext } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';
import { auditService } from './audit.service';

interface UpsertFaceProfilePayload {
  studentId: string;
  embeddingVersion: string;
  embeddingCount: number;
  registrationStatus: FaceRegistrationStatus;
  registeredAt?: Date | null;
  lastUpdatedAt?: Date | null;
  notes?: string | null;
}

interface UpdateFaceProfilePayload {
  embeddingVersion?: string;
  embeddingCount?: number;
  registrationStatus?: FaceRegistrationStatus;
  registeredAt?: Date | null;
  lastUpdatedAt?: Date | null;
  notes?: string | null;
}

interface FaceProfileOverviewQuery {
  page?: number;
  limit?: number;
  search?: string;
  classGroupId?: string;
  registrationStatus?: FaceRegistrationStatus;
  hasFaceProfile?: boolean;
}

const getStudentOrThrow = async (studentId: string) => {
  const student = await StudentModel.findById(studentId);

  if (!student) {
    throw new AppError('Student not found.', HTTP_STATUS.NOT_FOUND);
  }

  return student;
};

const getFaceProfileOrThrow = async (id: string) => {
  const faceProfile = await FaceProfileModel.findById(id);

  if (!faceProfile) {
    throw new AppError('Face profile not found.', HTTP_STATUS.NOT_FOUND);
  }

  return faceProfile;
};

const normalizeFaceProfilePayload = (
  payload: UpdateFaceProfilePayload,
): UpdateFaceProfilePayload => {
  return {
    ...payload,
    embeddingVersion: payload.embeddingVersion?.trim(),
    notes:
      payload.notes === undefined || payload.notes === null
        ? payload.notes
        : payload.notes.trim() || null,
  };
};

const syncStudentFaceProfileId = async (
  studentId: string,
  faceProfileId: string,
) => {
  await StudentModel.findByIdAndUpdate(studentId, {
    $set: { faceProfileId: new Types.ObjectId(faceProfileId) },
  });
};

export const faceProfileService = {
  getFaceProfileByStudentId: async (studentId: string): Promise<unknown> => {
    const faceProfile = await FaceProfileModel.findOne({ studentId });

    if (!faceProfile) {
      throw new AppError('Face profile not found.', HTTP_STATUS.NOT_FOUND);
    }

    return faceProfile.toJSON();
  },

  createFaceProfile: async (
    payload: UpsertFaceProfilePayload,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const student = await getStudentOrThrow(payload.studentId);

    const existingFaceProfile = await FaceProfileModel.findOne({
      studentId: payload.studentId,
    })
      .select('_id')
      .lean();

    if (existingFaceProfile) {
      throw new AppError(
        'A face profile already exists for this student.',
        HTTP_STATUS.CONFLICT,
      );
    }

    const normalizedPayload = normalizeFaceProfilePayload(payload);
    const faceProfile = await FaceProfileModel.create({
      studentId: student._id,
      embeddingVersion: normalizedPayload.embeddingVersion,
      embeddingCount: normalizedPayload.embeddingCount,
      registrationStatus: normalizedPayload.registrationStatus,
      registeredAt:
        normalizedPayload.registrationStatus === FaceRegistrationStatus.REGISTERED
          ? normalizedPayload.registeredAt ?? new Date()
          : normalizedPayload.registeredAt ?? null,
      lastUpdatedAt: normalizedPayload.lastUpdatedAt ?? new Date(),
      notes: normalizedPayload.notes ?? null,
    });

    student.faceProfileId = faceProfile._id;
    await student.save();
    await auditService.logAction({
      ...auditContext,
      action: 'face_profile.create',
      entityType: 'face_profile',
      entityId: faceProfile.id,
      metadata: {
        studentId: student.id,
        registrationStatus: faceProfile.registrationStatus,
      },
    });

    return faceProfile.toJSON();
  },

  updateFaceProfile: async (
    id: string,
    payload: UpdateFaceProfilePayload,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const faceProfile = await getFaceProfileOrThrow(id);
    const normalizedPayload = normalizeFaceProfilePayload(payload);

    if (normalizedPayload.embeddingVersion !== undefined) {
      faceProfile.embeddingVersion = normalizedPayload.embeddingVersion;
    }

    if (normalizedPayload.embeddingCount !== undefined) {
      faceProfile.embeddingCount = normalizedPayload.embeddingCount;
    }

    if (normalizedPayload.registrationStatus !== undefined) {
      faceProfile.registrationStatus = normalizedPayload.registrationStatus;
      faceProfile.registeredAt =
        normalizedPayload.registrationStatus === FaceRegistrationStatus.REGISTERED
          ? normalizedPayload.registeredAt ?? faceProfile.registeredAt ?? new Date()
          : normalizedPayload.registeredAt ?? null;
    } else if (normalizedPayload.registeredAt !== undefined) {
      faceProfile.registeredAt = normalizedPayload.registeredAt;
    }

    if (normalizedPayload.lastUpdatedAt !== undefined) {
      faceProfile.lastUpdatedAt = normalizedPayload.lastUpdatedAt;
    } else {
      faceProfile.lastUpdatedAt = new Date();
    }

    if (normalizedPayload.notes !== undefined) {
      faceProfile.notes = normalizedPayload.notes;
    }

    await faceProfile.save();
    await syncStudentFaceProfileId(String(faceProfile.studentId), faceProfile.id);
    await auditService.logAction({
      ...auditContext,
      action: 'face_profile.update',
      entityType: 'face_profile',
      entityId: faceProfile.id,
      metadata: {
        studentId: String(faceProfile.studentId),
        registrationStatus: faceProfile.registrationStatus,
      },
    });

    return faceProfile.toJSON();
  },

  updateFaceProfileStatus: async (
    id: string,
    payload: Pick<
      UpdateFaceProfilePayload,
      'registrationStatus' | 'registeredAt' | 'lastUpdatedAt' | 'notes'
    >,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    return faceProfileService.updateFaceProfile(id, payload, auditContext);
  },

  getFaceProfileOverview: async (
    query: FaceProfileOverviewQuery,
  ): Promise<{
    counts: Record<string, number>;
    items: unknown[];
    meta: PaginatedResult<unknown>['meta'];
  }> => {
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const studentFilter: Record<string, unknown> = {};

    if (query.classGroupId) {
      studentFilter.classGroupId = new Types.ObjectId(query.classGroupId);
    }

    const searchRegex = query.search ? new RegExp(query.search, 'i') : null;
    const pipeline: PipelineStage[] = [
      { $match: studentFilter },
      {
        $lookup: {
          from: 'faceprofiles',
          localField: '_id',
          foreignField: 'studentId',
          as: 'faceProfile',
        },
      },
      {
        $unwind: {
          path: '$faceProfile',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'classgroups',
          localField: 'classGroupId',
          foreignField: '_id',
          as: 'classGroup',
        },
      },
      {
        $unwind: {
          path: '$classGroup',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          fullName: {
            $trim: {
              input: {
                $concat: ['$firstName', ' ', '$lastName'],
              },
            },
          },
          hasFaceProfile: {
            $cond: [{ $ifNull: ['$faceProfile._id', false] }, true, false],
          },
        },
      },
      ...(query.hasFaceProfile === undefined
        ? []
        : [
            {
              $match: {
                hasFaceProfile: query.hasFaceProfile,
              },
            },
          ]),
      ...(query.registrationStatus
        ? [
            {
              $match: {
                'faceProfile.registrationStatus': query.registrationStatus,
              },
            },
          ]
        : []),
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { fullName: searchRegex },
                  { rollNumber: searchRegex },
                  { email: searchRegex },
                  { 'classGroup.code': searchRegex },
                  { 'faceProfile.embeddingVersion': searchRegex },
                ],
              },
            },
          ]
        : []),
      {
        $project: {
          _id: 0,
          studentId: { $toString: '$_id' },
          fullName: 1,
          rollNumber: 1,
          email: 1,
          status: 1,
          hasFaceProfile: 1,
          classGroup: {
            id: {
              $cond: [
                { $ifNull: ['$classGroup._id', false] },
                { $toString: '$classGroup._id' },
                null,
              ],
            },
            name: '$classGroup.name',
            code: '$classGroup.code',
          },
          faceProfile: {
            id: {
              $cond: [
                { $ifNull: ['$faceProfile._id', false] },
                { $toString: '$faceProfile._id' },
                null,
              ],
            },
            embeddingVersion: '$faceProfile.embeddingVersion',
            embeddingCount: '$faceProfile.embeddingCount',
            registrationStatus: '$faceProfile.registrationStatus',
            registeredAt: '$faceProfile.registeredAt',
            lastUpdatedAt: '$faceProfile.lastUpdatedAt',
            notes: '$faceProfile.notes',
          },
        },
      },
      {
        $sort: {
          hasFaceProfile: 1,
          rollNumber: 1,
          fullName: 1,
        },
      },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result, totalStudents, studentsWithFaceProfile, statusBreakdown] =
      await Promise.all([
        StudentModel.aggregate(pipeline),
        StudentModel.countDocuments(studentFilter),
        StudentModel.countDocuments({
          ...studentFilter,
          faceProfileId: { $ne: null },
        }),
        FaceProfileModel.aggregate<{ _id: FaceRegistrationStatus; count: number }>([
          {
            $lookup: {
              from: 'students',
              localField: 'studentId',
              foreignField: '_id',
              as: 'student',
            },
          },
          { $unwind: '$student' },
          {
            $match: {
              ...(query.classGroupId
                ? { 'student.classGroupId': new Types.ObjectId(query.classGroupId) }
                : {}),
            },
          },
          {
            $group: {
              _id: '$registrationStatus',
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    const totalItems = result[0]?.totalCount[0]?.count ?? 0;

    return {
      counts: {
        totalStudents,
        studentsWithFaceProfile,
        studentsWithoutFaceProfile: totalStudents - studentsWithFaceProfile,
        registeredCount:
          statusBreakdown.find(
            (item) => item._id === FaceRegistrationStatus.REGISTERED,
          )?.count ?? 0,
        pendingCount:
          statusBreakdown.find(
            (item) => item._id === FaceRegistrationStatus.PENDING,
          )?.count ?? 0,
        failedCount:
          statusBreakdown.find(
            (item) => item._id === FaceRegistrationStatus.FAILED,
          )?.count ?? 0,
      },
      items: result[0]?.items ?? [],
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  upsertFaceProfile: async (
    payload: UpsertFaceProfilePayload,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const existingFaceProfile = await FaceProfileModel.findOne({
      studentId: payload.studentId,
    })
      .select('_id')
      .lean() as { _id: unknown } | null;

    if (existingFaceProfile) {
      return faceProfileService.updateFaceProfile(
        String(existingFaceProfile._id),
        payload,
        auditContext,
      );
    }

    return faceProfileService.createFaceProfile(payload, auditContext);
  },
};
