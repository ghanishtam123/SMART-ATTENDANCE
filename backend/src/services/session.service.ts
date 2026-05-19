import { FilterQuery } from 'mongoose';

import { HTTP_STATUS } from '../constants/http';
import {
  ACTIVE_SESSION_STATUSES,
  SessionStatus,
} from '../constants/session';
import { UserRole } from '../constants/roles';
import { TimetableDayOfWeek } from '../constants/timetable';
import ClassGroupModel from '../models/ClassGroup.model';
import ClassroomModel from '../models/Classroom.model';
import SessionModel, { Session } from '../models/Session.model';
import SubjectModel from '../models/Subject.model';
import TeacherProfileModel from '../models/TeacherProfile.model';
import TimetableEntryModel from '../models/TimetableEntry.model';
import { AuthenticatedUser } from '../types/auth.types';
import { PaginatedResult, RequestAuditContext } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';
import { attendanceService } from './attendance.service';
import { auditService } from './audit.service';

interface SessionListQuery {
  page?: number;
  limit?: number;
  search?: string;
  scheduledDate?: string;
  teacherId?: string;
  classGroupId?: string;
  subjectId?: string;
  status?: SessionStatus;
}

interface SessionPayload {
  title?: string;
  classGroupId?: string;
  subjectId?: string;
  teacherId?: string;
  classroomId?: string;
  cameraIds?: string[];
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  graceMinutesForLate?: number;
  minimumPresenceMinutes?: number;
  minimumPresencePercentage?: number;
  notes?: string | null;
}

interface AutoCompleteOverdueSessionsOptions {
  sessionId?: string;
  trigger:
    | 'scheduler'
    | 'session_read'
    | 'live_read'
    | 'ingestion'
    | 'timetable_start'
    | 'manual_start';
  auditContext?: RequestAuditContext;
}

interface AutoCompleteOverdueSessionsSummary {
  checkedCount: number;
  completedCount: number;
  completedSessionIds: string[];
}

interface AiActiveSessionResult {
  sessionId: string;
  cameraId: string | null;
  status: SessionStatus;
}

const DEFAULT_TIMETABLE_SESSION_THRESHOLDS = {
  graceMinutesForLate: 5,
  minimumPresenceMinutes: 15,
  minimumPresencePercentage: 50,
} as const;

interface SessionReferenceBundle {
  classGroup: {
    _id: unknown;
    name: string;
    code: string;
    isActive: boolean;
  };
  subject: {
    _id: unknown;
    name: string;
    code: string;
    isActive: boolean;
  };
  teacherProfile: {
    _id: unknown;
  };
  classroom: {
    _id: unknown;
    cameraIds: string[];
    isActive: boolean;
  };
}

const normalizeSessionPayload = (payload: SessionPayload) => {
  return {
    ...payload,
    title: payload.title?.trim(),
    notes:
      payload.notes === undefined || payload.notes === null
        ? payload.notes
        : payload.notes.trim(),
    scheduledStartTime: payload.scheduledStartTime?.trim(),
    scheduledEndTime: payload.scheduledEndTime?.trim(),
    cameraIds: payload.cameraIds
      ? [...new Set(payload.cameraIds.map((cameraId) => cameraId.trim()))]
      : undefined,
  };
};

const getDateOnly = (dateValue: string): Date => {
  return new Date(`${dateValue}T00:00:00.000Z`);
};

const getNextDateOnly = (dateValue: string): Date => {
  const date = getDateOnly(dateValue);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

const getTimeInMinutes = (timeValue: string): number => {
  const [hours, minutes] = timeValue.split(':').map(Number);
  return hours * 60 + minutes;
};

const padDatePart = (value: number): string => String(value).padStart(2, '0');

const getDatePortion = (dateValue: Date): string => {
  return `${dateValue.getFullYear()}-${padDatePart(
    dateValue.getMonth() + 1,
  )}-${padDatePart(dateValue.getDate())}`;
};

const getScheduledDateTime = (scheduledDate: Date, timeValue: string): Date => {
  return new Date(`${getDatePortion(scheduledDate)}T${timeValue}:00`);
};

const getCurrentTimetableDayOfWeek = (dateValue: Date): TimetableDayOfWeek => {
  const labels: TimetableDayOfWeek[] = [
    TimetableDayOfWeek.SUNDAY,
    TimetableDayOfWeek.MONDAY,
    TimetableDayOfWeek.TUESDAY,
    TimetableDayOfWeek.WEDNESDAY,
    TimetableDayOfWeek.THURSDAY,
    TimetableDayOfWeek.FRIDAY,
    TimetableDayOfWeek.SATURDAY,
  ];

  return labels[dateValue.getDay()];
};

const getScheduledEndDateTime = (session: {
  scheduledDate: Date;
  scheduledEndTime: string;
}): Date => {
  return getScheduledDateTime(session.scheduledDate, session.scheduledEndTime);
};

const getScheduledStartDateTime = (session: {
  scheduledDate: Date;
  scheduledStartTime: string;
}): Date => {
  return getScheduledDateTime(session.scheduledDate, session.scheduledStartTime);
};

const hasSessionReachedEndTime = (
  session: {
    scheduledDate: Date;
    scheduledEndTime: string;
    actualEndTime: Date | null;
  },
  now: Date,
): boolean => {
  const completionDeadline =
    session.actualEndTime ?? getScheduledEndDateTime(session);

  return completionDeadline <= now;
};

const assertSessionCanStartWithinWindow = (
  session: {
    scheduledDate: Date;
    scheduledStartTime: string;
    scheduledEndTime: string;
  },
  now: Date,
  earlyMessage: string,
  lateMessage: string,
): void => {
  const scheduledStartAt = getScheduledStartDateTime(session);
  const scheduledEndAt = getScheduledEndDateTime(session);

  if (now < scheduledStartAt) {
    throw new AppError(earlyMessage, HTTP_STATUS.BAD_REQUEST, {
      scheduledStartTime: session.scheduledStartTime,
      scheduledDate: getDatePortion(session.scheduledDate),
    });
  }

  if (now >= scheduledEndAt) {
    throw new AppError(lateMessage, HTTP_STATUS.BAD_REQUEST, {
      scheduledEndTime: session.scheduledEndTime,
      scheduledDate: getDatePortion(session.scheduledDate),
    });
  }
};

const ensureValidScheduleWindow = (
  scheduledStartTime: string,
  scheduledEndTime: string,
): void => {
  if (getTimeInMinutes(scheduledEndTime) <= getTimeInMinutes(scheduledStartTime)) {
    throw new AppError(
      'Scheduled end time must be after scheduled start time.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
};

const ensureThresholdsAreConsistent = (payload: {
  minimumPresenceMinutes?: number;
  minimumPresencePercentage?: number;
}): void => {
  if (
    payload.minimumPresenceMinutes !== undefined &&
    payload.minimumPresenceMinutes < 0
  ) {
    throw new AppError(
      'Minimum presence minutes must be zero or greater.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  if (
    payload.minimumPresencePercentage !== undefined &&
    (payload.minimumPresencePercentage < 0 ||
      payload.minimumPresencePercentage > 100)
  ) {
    throw new AppError(
      'Minimum presence percentage must be between 0 and 100.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
};

const getSessionOrThrow = async (id: string) => {
  const session = await SessionModel.findById(id);

  if (!session) {
    throw new AppError('Session not found.', HTTP_STATUS.NOT_FOUND);
  }

  return session;
};

const getTeacherProfileIdForUser = async (
  userId: string,
): Promise<string | null> => {
  const teacherProfile = (await TeacherProfileModel.findOne({
    userId,
  })
    .select('_id')
    .lean()) as { _id: unknown } | null;

  return teacherProfile ? String(teacherProfile._id) : null;
};

const getReferenceBundle = async (payload: {
  classGroupId: string;
  subjectId: string;
  teacherId: string;
  classroomId: string;
}): Promise<SessionReferenceBundle> => {
  const classGroup = (await ClassGroupModel.findById(payload.classGroupId)
    .select('_id name code isActive')
    .lean()) as SessionReferenceBundle['classGroup'] | null;
  const subject = (await SubjectModel.findById(payload.subjectId)
    .select('_id name code isActive')
    .lean()) as SessionReferenceBundle['subject'] | null;
  const teacherProfile = (await TeacherProfileModel.findById(payload.teacherId)
    .select('_id')
    .lean()) as SessionReferenceBundle['teacherProfile'] | null;
  const classroom = (await ClassroomModel.findById(payload.classroomId)
    .select('_id cameraIds isActive')
    .lean()) as SessionReferenceBundle['classroom'] | null;

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

const resolveSessionTitle = (
  explicitTitle: string | undefined,
  references: SessionReferenceBundle,
): string => {
  if (explicitTitle) {
    return explicitTitle;
  }

  return `${references.subject.name} - ${references.classGroup.code}`;
};

const resolveSessionCameraIds = (
  explicitCameraIds: string[] | undefined,
  classroomCameraIds: string[],
): string[] => {
  const resolvedCameraIds =
    explicitCameraIds && explicitCameraIds.length > 0
      ? explicitCameraIds
      : classroomCameraIds;

  if (classroomCameraIds.length > 0) {
    const invalidCameraIds = resolvedCameraIds.filter(
      (cameraId) => !classroomCameraIds.includes(cameraId),
    );

    if (invalidCameraIds.length > 0) {
      throw new AppError(
        'Session cameraIds must belong to the selected classroom.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }
  }

  return resolvedCameraIds;
};

const assertNoConcurrentActiveSession = async (
  session: {
    classroomId: unknown;
    cameraIds: string[];
  },
  excludeId?: string,
): Promise<void> => {
  const orFilters: FilterQuery<Session>[] = [
    { classroomId: session.classroomId },
  ];

  if (session.cameraIds.length > 0) {
    orFilters.push({ cameraIds: { $in: session.cameraIds } });
  }

  const conflictingSession = await SessionModel.findOne({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    status: { $in: ACTIVE_SESSION_STATUSES },
    $or: orFilters,
  })
    .select('_id title status')
    .lean() as {
    _id: unknown;
    title?: string;
    status: SessionStatus;
  } | null;

  if (conflictingSession) {
    throw new AppError(
      'Another started or active session already exists for this classroom or one of its cameras.',
      HTTP_STATUS.CONFLICT,
      {
        conflictingSessionId: String(conflictingSession._id),
        conflictingSessionStatus: conflictingSession.status,
      },
    );
  }
};

const assertTeacherCanManageSession = async (
  sessionTeacherId: unknown,
  currentUser: AuthenticatedUser,
): Promise<void> => {
  if (currentUser.role !== UserRole.TEACHER) {
    return;
  }

  const teacherProfileId = await getTeacherProfileIdForUser(currentUser.userId);

  if (!teacherProfileId || teacherProfileId !== String(sessionTeacherId)) {
    throw new AppError(
      'You can only manage lifecycle actions for your own sessions.',
      HTTP_STATUS.FORBIDDEN,
    );
  }
};

const assertSessionCanBeUpdated = (status: SessionStatus): void => {
  if (status !== SessionStatus.CREATED) {
    throw new AppError(
      'Only sessions in created state can be updated.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
};

const assertSessionCanBeDeleted = (status: SessionStatus): void => {
  if (status !== SessionStatus.CREATED) {
    throw new AppError(
      'Only sessions in created state can be deleted.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }
};

const autoCompleteSession = async (
  session: Awaited<ReturnType<typeof getSessionOrThrow>>,
  options: AutoCompleteOverdueSessionsOptions,
): Promise<boolean> => {
  const now = new Date();

  if (
    !ACTIVE_SESSION_STATUSES.includes(session.status) ||
    !hasSessionReachedEndTime(session, now)
  ) {
    return false;
  }

  if (!session.actualStartTime) {
    session.actualStartTime = getScheduledDateTime(
      session.scheduledDate,
      session.scheduledStartTime,
    );
  }

  session.actualEndTime = session.actualEndTime ?? now;
  session.status = SessionStatus.COMPLETED;

  await session.save();

  try {
    await attendanceService.recalculateCompletedSessionAttendanceForSystem(
      session.id,
    );
  } catch (error) {
    console.error(
      'ERROR | Failed to recalculate attendance after automatic session completion.',
      {
        err: error,
        sessionId: session.id,
        trigger: options.trigger,
      },
    );
  }

  await auditService.logAction({
    ...options.auditContext,
    action: 'session.auto_complete',
    entityType: 'session',
    entityId: session.id,
    metadata: {
      trigger: options.trigger,
      status: session.status,
      actualEndTime: session.actualEndTime?.toISOString() ?? null,
    },
  });

  return true;
};

export const sessionService = {
  autoCompleteOverdueSessions: async (
    options: AutoCompleteOverdueSessionsOptions,
  ): Promise<AutoCompleteOverdueSessionsSummary> => {
    const candidates = await SessionModel.find({
      status: { $in: ACTIVE_SESSION_STATUSES },
      ...(options.sessionId ? { _id: options.sessionId } : {}),
    }).sort({ scheduledDate: 1, scheduledEndTime: 1, createdAt: 1 });

    const completedSessionIds: string[] = [];

    for (const session of candidates) {
      try {
        const completed = await autoCompleteSession(session, options);

        if (completed) {
          completedSessionIds.push(session.id);
        }
      } catch (error) {
        console.error(
          'ERROR | Failed to automatically complete overdue session.',
          {
            err: error,
            sessionId: session.id,
            trigger: options.trigger,
          },
        );
      }
    }

    return {
      checkedCount: candidates.length,
      completedCount: completedSessionIds.length,
      completedSessionIds,
    };
  },

  getActiveSessionForAi: async (
    cameraId?: string,
  ): Promise<AiActiveSessionResult | null> => {
    const normalizedCameraId = cameraId?.trim();
    const session = (await SessionModel.findOne({
      status: { $in: ACTIVE_SESSION_STATUSES },
      ...(normalizedCameraId ? { cameraIds: normalizedCameraId } : {}),
    })
      .sort({ actualStartTime: -1, updatedAt: -1, createdAt: -1 })
      .select('_id cameraIds status')
      .lean()) as {
      _id: unknown;
      cameraIds: string[];
      status: SessionStatus;
    } | null;

    if (!session) {
      return null;
    }

    const sessionCameraIds = Array.isArray(session.cameraIds)
      ? session.cameraIds.map((item: string) => String(item))
      : [];

    return {
      sessionId: String(session._id),
      cameraId: normalizedCameraId ?? sessionCameraIds[0] ?? null,
      status: session.status,
    };
  },

  listSessions: async (
    query: SessionListQuery,
  ): Promise<PaginatedResult<unknown>> => {
    await sessionService.autoCompleteOverdueSessions({
      trigger: 'session_read',
    });

    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const filter: FilterQuery<Session> = {};

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { notes: searchRegex },
        { scheduledStartTime: searchRegex },
        { scheduledEndTime: searchRegex },
      ];
    }

    if (query.scheduledDate) {
      filter.scheduledDate = {
        $gte: getDateOnly(query.scheduledDate),
        $lt: getNextDateOnly(query.scheduledDate),
      };
    }

    if (query.teacherId) {
      filter.teacherId = query.teacherId;
    }

    if (query.classGroupId) {
      filter.classGroupId = query.classGroupId;
    }

    if (query.subjectId) {
      filter.subjectId = query.subjectId;
    }

    if (query.status) {
      filter.status = query.status;
    }

    const [sessions, totalItems] = await Promise.all([
      SessionModel.find(filter)
        .sort({ scheduledDate: -1, scheduledStartTime: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SessionModel.countDocuments(filter),
    ]);

    return {
      items: sessions.map((session) => session.toJSON()),
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  getSessionById: async (id: string): Promise<unknown> => {
    await sessionService.autoCompleteOverdueSessions({
      sessionId: id,
      trigger: 'session_read',
    });

    const session = await getSessionOrThrow(id);
    return session.toJSON();
  },

  createStartedSessionFromTimetable: async (
    timetableEntryId: string,
    currentUser: AuthenticatedUser,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const timetableEntry = await TimetableEntryModel.findById(timetableEntryId).lean() as {
      _id: unknown;
      classGroupId: unknown;
      subjectId: unknown;
      teacherId: unknown;
      classroomId: unknown;
      cameraIds: string[];
      dayOfWeek: TimetableDayOfWeek;
      startTime: string;
      endTime: string;
      notes?: string | null;
      isActive: boolean;
    } | null;

    if (!timetableEntry) {
      throw new AppError('Timetable entry not found.', HTTP_STATUS.NOT_FOUND);
    }

    if (!timetableEntry.isActive) {
      throw new AppError(
        'Only active timetable entries can start sessions.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (currentUser.role === UserRole.TEACHER) {
      const teacherProfileId = await getTeacherProfileIdForUser(currentUser.userId);

      if (!teacherProfileId || teacherProfileId !== String(timetableEntry.teacherId)) {
        throw new AppError(
          'You can only start sessions from your own timetable entries.',
          HTTP_STATUS.FORBIDDEN,
        );
      }
    }

    const now = new Date();
    const todayDayOfWeek = getCurrentTimetableDayOfWeek(now);

    if (timetableEntry.dayOfWeek !== todayDayOfWeek) {
      throw new AppError(
        'This timetable entry can only be started on its scheduled day.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const today = getDatePortion(now);
    const scheduledDate = getDateOnly(today);

    ensureValidScheduleWindow(timetableEntry.startTime, timetableEntry.endTime);
    assertSessionCanStartWithinWindow(
      {
        scheduledDate,
        scheduledStartTime: timetableEntry.startTime,
        scheduledEndTime: timetableEntry.endTime,
      },
      now,
      'This session cannot be started before the timetable start time.',
      'This class has already ended for today and cannot be started.',
    );

    const existingSession = await SessionModel.findOne({
      timetableEntryId,
      scheduledDate: {
        $gte: scheduledDate,
        $lt: getNextDateOnly(today),
      },
    });

    if (existingSession) {
      if (ACTIVE_SESSION_STATUSES.includes(existingSession.status)) {
        await autoCompleteSession(existingSession, {
          trigger: 'timetable_start',
          auditContext,
        });
      }

      if (
        existingSession.status === SessionStatus.COMPLETED ||
        existingSession.status === SessionStatus.ARCHIVED
      ) {
        throw new AppError(
          'A session for this timetable entry has already been completed today and cannot be started again.',
          HTTP_STATUS.CONFLICT,
        );
      }

      if (existingSession.status === SessionStatus.CREATED) {
        await assertNoConcurrentActiveSession(
          {
            classroomId: existingSession.classroomId,
            cameraIds: existingSession.cameraIds,
          },
          existingSession.id,
        );

        if (!existingSession.actualStartTime) {
          existingSession.actualStartTime = now;
        }
        existingSession.status = SessionStatus.STARTED;
        await existingSession.save();
      }

      return existingSession.toJSON();
    }

    const references = await getReferenceBundle({
      classGroupId: String(timetableEntry.classGroupId),
      subjectId: String(timetableEntry.subjectId),
      teacherId: String(timetableEntry.teacherId),
      classroomId: String(timetableEntry.classroomId),
    });

    const resolvedCameraIds = resolveSessionCameraIds(
      timetableEntry.cameraIds,
      references.classroom.cameraIds,
    );

    await assertNoConcurrentActiveSession({
      classroomId: references.classroom._id,
      cameraIds: resolvedCameraIds,
    });

    const session = await SessionModel.create({
      title: resolveSessionTitle(undefined, references),
      timetableEntryId: timetableEntry._id,
      classGroupId: references.classGroup._id,
      subjectId: references.subject._id,
      teacherId: references.teacherProfile._id,
      classroomId: references.classroom._id,
      cameraIds: resolvedCameraIds,
      scheduledDate,
      scheduledStartTime: timetableEntry.startTime,
      scheduledEndTime: timetableEntry.endTime,
      actualStartTime: now,
      graceMinutesForLate: DEFAULT_TIMETABLE_SESSION_THRESHOLDS.graceMinutesForLate,
      minimumPresenceMinutes:
        DEFAULT_TIMETABLE_SESSION_THRESHOLDS.minimumPresenceMinutes,
      minimumPresencePercentage:
        DEFAULT_TIMETABLE_SESSION_THRESHOLDS.minimumPresencePercentage,
      notes: timetableEntry.notes ?? null,
      status: SessionStatus.STARTED,
    });

    await auditService.logAction({
      ...auditContext,
      actorUserId: currentUser.userId,
      action: 'session.start_from_timetable',
      entityType: 'session',
      entityId: session.id,
      metadata: {
        timetableEntryId,
        status: session.status,
      },
    });

    return session.toJSON();
  },

  createSession: async (payload: SessionPayload): Promise<unknown> => {
    const normalizedPayload = normalizeSessionPayload(payload);

    ensureValidScheduleWindow(
      normalizedPayload.scheduledStartTime!,
      normalizedPayload.scheduledEndTime!,
    );
    ensureThresholdsAreConsistent(normalizedPayload);

    const references = await getReferenceBundle({
      classGroupId: normalizedPayload.classGroupId!,
      subjectId: normalizedPayload.subjectId!,
      teacherId: normalizedPayload.teacherId!,
      classroomId: normalizedPayload.classroomId!,
    });

    const session = await SessionModel.create({
      title: resolveSessionTitle(normalizedPayload.title, references),
      classGroupId: normalizedPayload.classGroupId,
      subjectId: normalizedPayload.subjectId,
      teacherId: normalizedPayload.teacherId,
      classroomId: normalizedPayload.classroomId,
      cameraIds: resolveSessionCameraIds(
        normalizedPayload.cameraIds,
        references.classroom.cameraIds,
      ),
      scheduledDate: getDateOnly(normalizedPayload.scheduledDate!),
      scheduledStartTime: normalizedPayload.scheduledStartTime,
      scheduledEndTime: normalizedPayload.scheduledEndTime,
      graceMinutesForLate: normalizedPayload.graceMinutesForLate,
      minimumPresenceMinutes: normalizedPayload.minimumPresenceMinutes,
      minimumPresencePercentage: normalizedPayload.minimumPresencePercentage,
      notes: normalizedPayload.notes ?? null,
      status: SessionStatus.CREATED,
    });

    return session.toJSON();
  },

  updateSession: async (id: string, payload: SessionPayload): Promise<unknown> => {
    const session = await getSessionOrThrow(id);
    assertSessionCanBeUpdated(session.status);

    const normalizedPayload = normalizeSessionPayload(payload);
    const scheduledStartTime =
      normalizedPayload.scheduledStartTime ?? session.scheduledStartTime;
    const scheduledEndTime =
      normalizedPayload.scheduledEndTime ?? session.scheduledEndTime;

    ensureValidScheduleWindow(scheduledStartTime, scheduledEndTime);
    ensureThresholdsAreConsistent(normalizedPayload);

    const referenceIds = {
      classGroupId:
        normalizedPayload.classGroupId ?? String(session.classGroupId),
      subjectId: normalizedPayload.subjectId ?? String(session.subjectId),
      teacherId: normalizedPayload.teacherId ?? String(session.teacherId),
      classroomId: normalizedPayload.classroomId ?? String(session.classroomId),
    };

    const references = await getReferenceBundle(referenceIds);

    session.title =
      normalizedPayload.title === undefined
        ? session.title ?? resolveSessionTitle(undefined, references)
        : resolveSessionTitle(normalizedPayload.title, references);
    session.classGroupId = references.classGroup._id as Session['classGroupId'];
    session.subjectId = references.subject._id as Session['subjectId'];
    session.teacherId = references.teacherProfile._id as Session['teacherId'];
    session.classroomId = references.classroom._id as Session['classroomId'];
    session.cameraIds = resolveSessionCameraIds(
      normalizedPayload.cameraIds ?? session.cameraIds,
      references.classroom.cameraIds,
    );
    session.scheduledDate = normalizedPayload.scheduledDate
      ? getDateOnly(normalizedPayload.scheduledDate)
      : session.scheduledDate;
    session.scheduledStartTime = scheduledStartTime;
    session.scheduledEndTime = scheduledEndTime;
    session.graceMinutesForLate =
      normalizedPayload.graceMinutesForLate ?? session.graceMinutesForLate;
    session.minimumPresenceMinutes =
      normalizedPayload.minimumPresenceMinutes ?? session.minimumPresenceMinutes;
    session.minimumPresencePercentage =
      normalizedPayload.minimumPresencePercentage ??
      session.minimumPresencePercentage;
    session.notes =
      normalizedPayload.notes === undefined ? session.notes : normalizedPayload.notes;

    await session.save();

    return session.toJSON();
  },

  deleteSession: async (id: string): Promise<unknown> => {
    const session = await getSessionOrThrow(id);
    assertSessionCanBeDeleted(session.status);
    await session.deleteOne();
    return session.toJSON();
  },

  startSession: async (
    id: string,
    currentUser: AuthenticatedUser,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const session = await getSessionOrThrow(id);

    await assertTeacherCanManageSession(session.teacherId, currentUser);

    if (ACTIVE_SESSION_STATUSES.includes(session.status)) {
      await autoCompleteSession(session, {
        trigger: 'manual_start',
        auditContext,
      });
    }

    if (session.status === SessionStatus.COMPLETED) {
      throw new AppError(
        'Completed sessions cannot be started again.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (session.status === SessionStatus.ARCHIVED) {
      throw new AppError(
        'Archived sessions cannot be started.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (
      session.status === SessionStatus.STARTED ||
      session.status === SessionStatus.ACTIVE
    ) {
      throw new AppError(
        'Session is already started.',
        HTTP_STATUS.CONFLICT,
      );
    }

    const now = new Date();
    assertSessionCanStartWithinWindow(
      {
        scheduledDate: session.scheduledDate,
        scheduledStartTime: session.scheduledStartTime,
        scheduledEndTime: session.scheduledEndTime,
      },
      now,
      'This session cannot be started before its scheduled start time.',
      'This session has already passed its end time and cannot be started.',
    );

    await assertNoConcurrentActiveSession(
      {
        classroomId: session.classroomId,
        cameraIds: session.cameraIds,
      },
      session.id,
    );

    if (!session.actualStartTime) {
      session.actualStartTime = now;
    }

    session.status = SessionStatus.STARTED;

    await session.save();
    await auditService.logAction({
      ...auditContext,
      actorUserId: currentUser.userId,
      action: 'session.start',
      entityType: 'session',
      entityId: session.id,
      metadata: {
        status: session.status,
        actualStartTime: session.actualStartTime?.toISOString() ?? null,
      },
    });

    return session.toJSON();
  },

  completeSession: async (
    id: string,
    currentUser: AuthenticatedUser,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const session = await getSessionOrThrow(id);

    await assertTeacherCanManageSession(session.teacherId, currentUser);

    if (session.status === SessionStatus.ARCHIVED) {
      throw new AppError(
        'Archived sessions cannot be completed.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (session.status === SessionStatus.COMPLETED) {
      throw new AppError(
        'Session is already completed.',
        HTTP_STATUS.CONFLICT,
      );
    }

    if (session.status === SessionStatus.CREATED) {
      throw new AppError(
        'Session must be started before it can be completed.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (!session.actualStartTime) {
      session.actualStartTime = new Date();
    }

    session.actualEndTime = new Date();
    session.status = SessionStatus.COMPLETED;

    await session.save();
    await auditService.logAction({
      ...auditContext,
      actorUserId: currentUser.userId,
      action: 'session.complete',
      entityType: 'session',
      entityId: session.id,
      metadata: {
        status: session.status,
        actualEndTime: session.actualEndTime?.toISOString() ?? null,
      },
    });

    return session.toJSON();
  },

  archiveSession: async (
    id: string,
    currentUser: AuthenticatedUser,
    auditContext?: RequestAuditContext,
  ): Promise<unknown> => {
    const session = await getSessionOrThrow(id);

    if (session.status === SessionStatus.ARCHIVED) {
      throw new AppError(
        'Session is already archived.',
        HTTP_STATUS.CONFLICT,
      );
    }

    if (
      session.status === SessionStatus.STARTED ||
      session.status === SessionStatus.ACTIVE
    ) {
      throw new AppError(
        'Started or active sessions must be completed before archive.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (session.status === SessionStatus.CREATED) {
      throw new AppError(
        'Only completed sessions can be archived.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    session.status = SessionStatus.ARCHIVED;
    await session.save();
    await auditService.logAction({
      ...auditContext,
      actorUserId: currentUser.userId,
      action: 'session.archive',
      entityType: 'session',
      entityId: session.id,
      metadata: {
        status: session.status,
      },
    });

    return session.toJSON();
  },
};
