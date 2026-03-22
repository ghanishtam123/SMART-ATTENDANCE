import { FilterQuery } from 'mongoose';

import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import { TimetableDayOfWeek } from '../constants/timetable';
import ClassGroupModel from '../models/ClassGroup.model';
import ClassroomModel from '../models/Classroom.model';
import SubjectModel from '../models/Subject.model';
import TeacherProfileModel from '../models/TeacherProfile.model';
import TimetableEntryModel, {
  TimetableEntry,
} from '../models/TimetableEntry.model';
import { AuthenticatedUser } from '../types/auth.types';
import { PaginatedResult } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';

interface TimetableListQuery {
  page?: number;
  limit?: number;
  search?: string;
  dayOfWeek?: TimetableDayOfWeek;
  classGroupId?: string;
  teacherId?: string;
  classroomId?: string;
  isActive?: boolean;
}

interface TimetablePayload {
  classGroupId?: string;
  subjectId?: string;
  teacherId?: string;
  classroomId?: string;
  dayOfWeek?: TimetableDayOfWeek;
  startTime?: string;
  endTime?: string;
  cameraIds?: string[];
  isActive?: boolean;
  notes?: string | null;
}

interface TimetableReferenceBundle {
  classGroup: {
    _id: unknown;
    isActive: boolean;
  };
  subject: {
    _id: unknown;
    isActive: boolean;
  };
  teacherProfile: {
    _id: unknown;
  };
  classroom: {
    _id: unknown;
    isActive: boolean;
    cameraIds: string[];
  };
}

const normalizeTimetablePayload = (payload: TimetablePayload) => {
  return {
    ...payload,
    startTime: payload.startTime?.trim(),
    endTime: payload.endTime?.trim(),
    notes:
      payload.notes === undefined || payload.notes === null
        ? payload.notes
        : payload.notes.trim(),
    cameraIds: payload.cameraIds
      ? [...new Set(payload.cameraIds.map((cameraId) => cameraId.trim()))]
      : undefined,
  };
};

const getTimeInMinutes = (timeValue: string): number => {
  const [hours, minutes] = timeValue.split(':').map(Number);
  return hours * 60 + minutes;
};

const assertValidTimeWindow = (startTime: string, endTime: string) => {
  if (getTimeInMinutes(endTime) <= getTimeInMinutes(startTime)) {
    throw new AppError(
      'End time must be after start time.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
};

const getTeacherProfileIdOrThrow = async (
  currentUser: AuthenticatedUser,
): Promise<string | null> => {
  if (currentUser.role !== UserRole.TEACHER) {
    return null;
  }

  const teacherProfile = await TeacherProfileModel.findOne({
    userId: currentUser.userId,
  })
    .select('_id')
    .lean() as { _id: unknown } | null;

  if (!teacherProfile) {
    throw new AppError(
      'Teacher profile not found for the authenticated user.',
      HTTP_STATUS.FORBIDDEN,
    );
  }

  return String(teacherProfile._id);
};

const getTimetableEntryOrThrow = async (id: string) => {
  const timetableEntry = await TimetableEntryModel.findById(id);

  if (!timetableEntry) {
    throw new AppError('Timetable entry not found.', HTTP_STATUS.NOT_FOUND);
  }

  return timetableEntry;
};

const getReferenceBundle = async (payload: {
  classGroupId: string;
  subjectId: string;
  teacherId: string;
  classroomId: string;
}): Promise<TimetableReferenceBundle> => {
  const classGroup = (await ClassGroupModel.findById(payload.classGroupId)
    .select('_id isActive')
    .lean()) as TimetableReferenceBundle['classGroup'] | null;
  const subject = (await SubjectModel.findById(payload.subjectId)
    .select('_id isActive')
    .lean()) as TimetableReferenceBundle['subject'] | null;
  const teacherProfile = (await TeacherProfileModel.findById(payload.teacherId)
    .select('_id')
    .lean()) as TimetableReferenceBundle['teacherProfile'] | null;
  const classroom = (await ClassroomModel.findById(payload.classroomId)
    .select('_id isActive cameraIds')
    .lean()) as TimetableReferenceBundle['classroom'] | null;

  if (!classGroup || !classGroup.isActive) {
    throw new AppError(
      'Class group not found or inactive.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  if (!subject || !subject.isActive) {
    throw new AppError('Subject not found or inactive.', HTTP_STATUS.BAD_REQUEST);
  }

  if (!teacherProfile) {
    throw new AppError('Teacher profile not found.', HTTP_STATUS.BAD_REQUEST);
  }

  if (!classroom || !classroom.isActive) {
    throw new AppError('Classroom not found or inactive.', HTTP_STATUS.BAD_REQUEST);
  }

  return {
    classGroup,
    subject,
    teacherProfile,
    classroom,
  };
};

const resolveCameraIds = (
  requestedCameraIds: string[] | undefined,
  classroomCameraIds: string[],
) => {
  const resolvedCameraIds =
    requestedCameraIds && requestedCameraIds.length > 0
      ? requestedCameraIds
      : classroomCameraIds;

  if (classroomCameraIds.length > 0) {
    const invalidCameraIds = resolvedCameraIds.filter(
      (cameraId) => !classroomCameraIds.includes(cameraId),
    );

    if (invalidCameraIds.length > 0) {
      throw new AppError(
        'Timetable cameraIds must belong to the selected classroom.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }
  }

  return resolvedCameraIds;
};

const doTimeRangesOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) => {
  return (
    getTimeInMinutes(startA) < getTimeInMinutes(endB) &&
    getTimeInMinutes(startB) < getTimeInMinutes(endA)
  );
};

const assertNoConflictingActiveEntry = async (
  payload: {
    classGroupId: string;
    teacherId: string;
    classroomId: string;
    dayOfWeek: TimetableDayOfWeek;
    startTime: string;
    endTime: string;
    cameraIds: string[];
    isActive: boolean;
  },
  excludeId?: string,
) => {
  if (!payload.isActive) {
    return;
  }

  const candidateEntries = await TimetableEntryModel.find({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    dayOfWeek: payload.dayOfWeek,
    isActive: true,
    $or: [
      { classGroupId: payload.classGroupId },
      { teacherId: payload.teacherId },
      { classroomId: payload.classroomId },
      ...(payload.cameraIds.length > 0
        ? [{ cameraIds: { $in: payload.cameraIds } }]
        : []),
    ],
  }).select(
    '_id classGroupId teacherId classroomId cameraIds startTime endTime',
  );

  const conflictingEntry = candidateEntries.find((entry) =>
    doTimeRangesOverlap(
      payload.startTime,
      payload.endTime,
      entry.startTime,
      entry.endTime,
    ),
  );

  if (conflictingEntry) {
    throw new AppError(
      'Conflicting active timetable entry already exists for the class group, teacher, classroom, or selected cameras.',
      HTTP_STATUS.CONFLICT,
      {
        conflictingTimetableEntryId: conflictingEntry.id,
      },
    );
  }
};

export const timetableService = {
  listTimetableEntries: async (
    query: TimetableListQuery,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<unknown>> => {
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const filter: FilterQuery<TimetableEntry> = {};

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { notes: searchRegex },
        { startTime: searchRegex },
        { endTime: searchRegex },
      ];
    }

    if (query.dayOfWeek) {
      filter.dayOfWeek = query.dayOfWeek;
    }

    if (query.classGroupId) {
      filter.classGroupId = query.classGroupId;
    }

    if (query.teacherId) {
      filter.teacherId = query.teacherId;
    }

    if (query.classroomId) {
      filter.classroomId = query.classroomId;
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    const teacherProfileId = await getTeacherProfileIdOrThrow(currentUser);

    if (teacherProfileId) {
      filter.teacherId = teacherProfileId;
    }

    const [entries, totalItems] = await Promise.all([
      TimetableEntryModel.find(filter)
        .sort({ dayOfWeek: 1, startTime: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TimetableEntryModel.countDocuments(filter),
    ]);

    return {
      items: entries.map((entry) => entry.toJSON()),
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  getTimetableEntryById: async (
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<unknown> => {
    const timetableEntry = await getTimetableEntryOrThrow(id);
    const teacherProfileId = await getTeacherProfileIdOrThrow(currentUser);

    if (teacherProfileId && teacherProfileId !== String(timetableEntry.teacherId)) {
      throw new AppError(
        'You can only access your own timetable entries.',
        HTTP_STATUS.FORBIDDEN,
      );
    }

    return timetableEntry.toJSON();
  },

  createTimetableEntry: async (payload: TimetablePayload): Promise<unknown> => {
    const normalizedPayload = normalizeTimetablePayload(payload);

    assertValidTimeWindow(
      normalizedPayload.startTime!,
      normalizedPayload.endTime!,
    );

    const references = await getReferenceBundle({
      classGroupId: normalizedPayload.classGroupId!,
      subjectId: normalizedPayload.subjectId!,
      teacherId: normalizedPayload.teacherId!,
      classroomId: normalizedPayload.classroomId!,
    });
    const resolvedCameraIds = resolveCameraIds(
      normalizedPayload.cameraIds,
      references.classroom.cameraIds,
    );

    await assertNoConflictingActiveEntry({
      classGroupId: normalizedPayload.classGroupId!,
      teacherId: normalizedPayload.teacherId!,
      classroomId: normalizedPayload.classroomId!,
      dayOfWeek: normalizedPayload.dayOfWeek!,
      startTime: normalizedPayload.startTime!,
      endTime: normalizedPayload.endTime!,
      cameraIds: resolvedCameraIds,
      isActive: normalizedPayload.isActive ?? true,
    });

    const timetableEntry = await TimetableEntryModel.create({
      classGroupId: references.classGroup._id,
      subjectId: references.subject._id,
      teacherId: references.teacherProfile._id,
      classroomId: references.classroom._id,
      dayOfWeek: normalizedPayload.dayOfWeek,
      startTime: normalizedPayload.startTime,
      endTime: normalizedPayload.endTime,
      cameraIds: resolvedCameraIds,
      isActive: normalizedPayload.isActive ?? true,
      notes: normalizedPayload.notes ?? null,
    });

    return timetableEntry.toJSON();
  },

  updateTimetableEntry: async (
    id: string,
    payload: TimetablePayload,
  ): Promise<unknown> => {
    const timetableEntry = await getTimetableEntryOrThrow(id);
    const normalizedPayload = normalizeTimetablePayload(payload);
    const startTime = normalizedPayload.startTime ?? timetableEntry.startTime;
    const endTime = normalizedPayload.endTime ?? timetableEntry.endTime;

    assertValidTimeWindow(startTime, endTime);

    const referenceIds = {
      classGroupId:
        normalizedPayload.classGroupId ?? String(timetableEntry.classGroupId),
      subjectId: normalizedPayload.subjectId ?? String(timetableEntry.subjectId),
      teacherId: normalizedPayload.teacherId ?? String(timetableEntry.teacherId),
      classroomId:
        normalizedPayload.classroomId ?? String(timetableEntry.classroomId),
    };
    const references = await getReferenceBundle(referenceIds);
    const resolvedCameraIds = resolveCameraIds(
      normalizedPayload.cameraIds ?? timetableEntry.cameraIds,
      references.classroom.cameraIds,
    );
    const isActive = normalizedPayload.isActive ?? timetableEntry.isActive;

    await assertNoConflictingActiveEntry(
      {
        classGroupId: referenceIds.classGroupId,
        teacherId: referenceIds.teacherId,
        classroomId: referenceIds.classroomId,
        dayOfWeek: normalizedPayload.dayOfWeek ?? timetableEntry.dayOfWeek,
        startTime,
        endTime,
        cameraIds: resolvedCameraIds,
        isActive,
      },
      timetableEntry.id,
    );

    timetableEntry.classGroupId = references.classGroup._id as TimetableEntry['classGroupId'];
    timetableEntry.subjectId = references.subject._id as TimetableEntry['subjectId'];
    timetableEntry.teacherId = references.teacherProfile._id as TimetableEntry['teacherId'];
    timetableEntry.classroomId = references.classroom._id as TimetableEntry['classroomId'];
    timetableEntry.dayOfWeek =
      normalizedPayload.dayOfWeek ?? timetableEntry.dayOfWeek;
    timetableEntry.startTime = startTime;
    timetableEntry.endTime = endTime;
    timetableEntry.cameraIds = resolvedCameraIds;
    timetableEntry.isActive = isActive;
    timetableEntry.notes =
      normalizedPayload.notes === undefined
        ? timetableEntry.notes
        : normalizedPayload.notes;

    await timetableEntry.save();

    return timetableEntry.toJSON();
  },

  deleteTimetableEntry: async (id: string): Promise<unknown> => {
    const timetableEntry = await getTimetableEntryOrThrow(id);
    await timetableEntry.deleteOne();
    return timetableEntry.toJSON();
  },
};
