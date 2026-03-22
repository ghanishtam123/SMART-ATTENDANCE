import { FilterQuery, Types } from 'mongoose';

import { AttendanceStatus } from '../constants/attendance';
import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import { SessionStatus } from '../constants/session';
import { StudentStatus } from '../constants/student';
import AttendanceEventModel from '../models/AttendanceEvent.model';
import AttendanceRecordModel, {
  AttendanceRecord,
} from '../models/AttendanceRecord.model';
import ClassGroupModel from '../models/ClassGroup.model';
import SessionModel, { Session } from '../models/Session.model';
import StudentModel from '../models/Student.model';
import TeacherProfileModel from '../models/TeacherProfile.model';
import UnknownFaceAlertModel from '../models/UnknownFaceAlert.model';
import { AuthenticatedUser } from '../types/auth.types';
import { PaginatedResult, RequestAuditContext } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';
import { ExportPayload } from '../utils/export';
import { auditService } from './audit.service';
import { attendanceRuleService } from './attendanceRule.service';

interface SessionAttendanceQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: AttendanceStatus;
  from?: string;
  to?: string;
}

interface StudentAttendanceHistoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: AttendanceStatus;
  from?: string;
  to?: string;
}

interface ClassGroupAttendanceSummaryQuery {
  from?: string;
  to?: string;
}

interface AttendanceLifecycleOptions {
  finalize: boolean;
}

interface AttendanceLifecycleSummary {
  sessionId: string;
  totalStudentsEvaluated: number;
  recordsUpserted: number;
  statusBreakdown: Record<AttendanceStatus, number>;
  finalized: boolean;
  finalizedAt: string | null;
}

interface AttendanceStatusSummary {
  totalRecords: number;
  attendedCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  leftEarlyCount: number;
}

const getSessionOrThrow = async (sessionId: string) => {
  const session = await SessionModel.findById(sessionId);

  if (!session) {
    throw new AppError('Session not found.', HTTP_STATUS.NOT_FOUND);
  }

  return session;
};

const getTeacherProfileIdForUser = async (
  currentUser: AuthenticatedUser,
): Promise<string | null> => {
  const teacherProfile = await TeacherProfileModel.findOne({
    userId: currentUser.userId,
  })
    .select('_id')
    .lean() as { _id: Types.ObjectId } | null;

  return teacherProfile ? String(teacherProfile._id) : null;
};

const roundTo = (value: number, precision = 2): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const getDateStart = (dateValue: string): Date => {
  return new Date(`${dateValue}T00:00:00.000Z`);
};

const getNextDateStart = (dateValue: string): Date => {
  const nextDate = getDateStart(dateValue);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate;
};

const applyScheduledDateRange = (
  filter: FilterQuery<Session>,
  query: { from?: string; to?: string },
): FilterQuery<Session> => {
  if (!query.from && !query.to) {
    return filter;
  }

  filter.scheduledDate = {
    ...(query.from ? { $gte: getDateStart(query.from) } : {}),
    ...(query.to ? { $lt: getNextDateStart(query.to) } : {}),
  };

  return filter;
};

const buildScopedSessionFilter = async (
  currentUser: AuthenticatedUser,
  baseFilter: FilterQuery<Session>,
  query?: { from?: string; to?: string },
): Promise<FilterQuery<Session>> => {
  const filter: FilterQuery<Session> = { ...baseFilter };
  applyScheduledDateRange(filter, query ?? {});

  if (currentUser.role === UserRole.TEACHER) {
    const teacherProfileId = await getTeacherProfileIdForUser(currentUser);

    if (!teacherProfileId) {
      throw new AppError(
        'Teacher profile not found for the authenticated user.',
        HTTP_STATUS.FORBIDDEN,
      );
    }

    filter.teacherId = new Types.ObjectId(teacherProfileId);
  }

  return filter;
};

const getAttendanceStatusSummary = async (
  filter: FilterQuery<AttendanceRecord>,
): Promise<AttendanceStatusSummary> => {
  const [summary] = await AttendanceRecordModel.aggregate<AttendanceStatusSummary>([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalRecords: { $sum: 1 },
        attendedCount: {
          $sum: {
            $cond: [{ $ne: ['$status', AttendanceStatus.ABSENT] }, 1, 0],
          },
        },
        presentCount: {
          $sum: {
            $cond: [{ $eq: ['$status', AttendanceStatus.PRESENT] }, 1, 0],
          },
        },
        lateCount: {
          $sum: {
            $cond: [{ $eq: ['$status', AttendanceStatus.LATE] }, 1, 0],
          },
        },
        absentCount: {
          $sum: {
            $cond: [{ $eq: ['$status', AttendanceStatus.ABSENT] }, 1, 0],
          },
        },
        leftEarlyCount: {
          $sum: {
            $cond: [{ $eq: ['$status', AttendanceStatus.LEFT_EARLY] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalRecords: 1,
        attendedCount: 1,
        presentCount: 1,
        lateCount: 1,
        absentCount: 1,
        leftEarlyCount: 1,
      },
    },
  ]);

  return (
    summary ?? {
      totalRecords: 0,
      attendedCount: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      leftEarlyCount: 0,
    }
  );
};

const calculateAttendancePercentage = (
  attendedCount: number,
  totalCount: number,
): number => {
  if (totalCount <= 0) {
    return 0;
  }

  return roundTo((attendedCount / totalCount) * 100);
};

const assertTeacherCanAccessSession = async (
  sessionTeacherId: Types.ObjectId,
  currentUser: AuthenticatedUser,
): Promise<void> => {
  if (currentUser.role !== UserRole.TEACHER) {
    return;
  }

  const teacherProfileId = await getTeacherProfileIdForUser(currentUser);

  if (!teacherProfileId || teacherProfileId !== String(sessionTeacherId)) {
    throw new AppError(
      'You can only access attendance for your own sessions.',
      HTTP_STATUS.FORBIDDEN,
    );
  }
};

const getScheduledDateTime = (scheduledDate: Date, timeValue: string): Date => {
  const datePortion = scheduledDate.toISOString().slice(0, 10);
  return new Date(`${datePortion}T${timeValue}:00.000Z`);
};

const getEffectiveSessionWindow = (session: Awaited<ReturnType<typeof getSessionOrThrow>>) => {
  const scheduledStartAt = getScheduledDateTime(
    session.scheduledDate,
    session.scheduledStartTime,
  );
  const scheduledEndAt = getScheduledDateTime(
    session.scheduledDate,
    session.scheduledEndTime,
  );
  const sessionStartAt = session.actualStartTime ?? scheduledStartAt;
  let sessionEndAt = session.actualEndTime ?? scheduledEndAt;

  if (sessionEndAt < sessionStartAt) {
    sessionEndAt = sessionStartAt;
  }

  return {
    sessionStartAt,
    sessionEndAt,
  };
};

const buildStatusBreakdown = () => ({
  [AttendanceStatus.PRESENT]: 0,
  [AttendanceStatus.LATE]: 0,
  [AttendanceStatus.ABSENT]: 0,
  [AttendanceStatus.LEFT_EARLY]: 0,
});

const deriveAttendanceRecords = async (
  sessionId: string,
  options: AttendanceLifecycleOptions,
): Promise<AttendanceLifecycleSummary> => {
  const session = await getSessionOrThrow(sessionId);

  if (
    session.status !== SessionStatus.COMPLETED &&
    session.status !== SessionStatus.ARCHIVED
  ) {
    throw new AppError(
      options.finalize
        ? 'Attendance can only be finalized after a session is completed.'
        : 'Attendance can only be recalculated after a session is completed.',
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  const { sessionStartAt, sessionEndAt } = getEffectiveSessionWindow(session);

  const [students, existingRecords, attendanceEvents] = await Promise.all([
    StudentModel.find({
      classGroupId: session.classGroupId,
      status: StudentStatus.ACTIVE,
    })
      .select('_id')
      .lean() as Promise<Array<{ _id: Types.ObjectId }>>,
    AttendanceRecordModel.find({ sessionId: session._id }).select(
      '_id studentId finalizedAt',
    ),
    AttendanceEventModel.find({
      sessionId: session._id,
      isUnknown: false,
      studentId: { $ne: null },
      eventTimestamp: {
        $gte: sessionStartAt,
        $lte: sessionEndAt,
      },
    })
      .sort({ eventTimestamp: 1 })
      .select('studentId confidence eventTimestamp'),
  ]);

  const rosterStudentIds = students.map((student) => String(student._id));
  const rosterStudentIdSet = new Set(rosterStudentIds);

  const eventsByStudent = new Map<
    string,
    Array<{ eventTimestamp: Date; confidence: number }>
  >();

  attendanceEvents.forEach((event) => {
    if (!event.studentId) {
      return;
    }

    const studentId = String(event.studentId);

    if (!rosterStudentIdSet.has(studentId)) {
      return;
    }

    const studentEvents = eventsByStudent.get(studentId) ?? [];
    studentEvents.push({
      eventTimestamp: event.eventTimestamp,
      confidence: event.confidence,
    });
    eventsByStudent.set(studentId, studentEvents);
  });

  const existingRecordMap = new Map(
    existingRecords.map((record) => [String(record.studentId), record]),
  );
  const finalizedAt = options.finalize ? new Date() : null;
  const statusBreakdown = buildStatusBreakdown();

  const bulkOperations = students.map((student) => {
    const studentId = String(student._id);
    const studentEvents = eventsByStudent.get(studentId) ?? [];
    const computation = attendanceRuleService.evaluateAttendance({
      sessionStartAt,
      sessionEndAt,
      eventTimestamps: studentEvents.map((event) => event.eventTimestamp),
      confidences: studentEvents.map((event) => event.confidence),
      graceMinutesForLate: session.graceMinutesForLate,
      minimumPresenceMinutes: session.minimumPresenceMinutes,
      minimumPresencePercentage: session.minimumPresencePercentage,
    });

    statusBreakdown[computation.status] += 1;

    return {
      updateOne: {
        filter: {
          sessionId: session._id,
          studentId: student._id,
        },
        update: {
          $set: {
            classGroupId: session.classGroupId,
            subjectId: session.subjectId,
            teacherId: session.teacherId,
            status: computation.status,
            firstSeenAt: computation.firstSeenAt,
            lastSeenAt: computation.lastSeenAt,
            totalPresenceMinutes: computation.totalPresenceMinutes,
            attendancePercentageInSession:
              computation.attendancePercentageInSession,
            confidenceAverage: computation.confidenceAverage,
            eventCount: computation.eventCount,
            remarks: computation.remarks,
            finalizedAt:
              finalizedAt ??
              existingRecordMap.get(studentId)?.finalizedAt ??
              null,
          },
        },
        upsert: true,
      },
    };
  });

  if (bulkOperations.length > 0) {
    await AttendanceRecordModel.bulkWrite(bulkOperations);
  }

  if (options.finalize) {
    await AttendanceEventModel.updateMany(
      { sessionId: session._id },
      { $set: { processed: true } },
    );
  }

  return {
    sessionId: String(session._id),
    totalStudentsEvaluated: students.length,
    recordsUpserted: bulkOperations.length,
    statusBreakdown,
    finalized: options.finalize,
    finalizedAt: finalizedAt ? finalizedAt.toISOString() : null,
  };
};

export const attendanceService = {
  recalculateSessionAttendance: async (
    sessionId: string,
    currentUser: AuthenticatedUser,
  ): Promise<AttendanceLifecycleSummary> => {
    const session = await getSessionOrThrow(sessionId);
    await assertTeacherCanAccessSession(session.teacherId, currentUser);

    return deriveAttendanceRecords(sessionId, { finalize: false });
  },

  finalizeSessionAttendance: async (
    sessionId: string,
    currentUser: AuthenticatedUser,
    auditContext?: RequestAuditContext,
  ): Promise<AttendanceLifecycleSummary> => {
    const session = await getSessionOrThrow(sessionId);
    await assertTeacherCanAccessSession(session.teacherId, currentUser);

    const result = await deriveAttendanceRecords(sessionId, { finalize: true });
    await auditService.logAction({
      ...auditContext,
      actorUserId: currentUser.userId,
      action: 'attendance.finalize',
      entityType: 'session',
      entityId: session.id,
      metadata: {
        totalStudentsEvaluated: result.totalStudentsEvaluated,
        recordsUpserted: result.recordsUpserted,
        statusBreakdown: result.statusBreakdown,
        finalizedAt: result.finalizedAt,
      },
    });

    return result;
  },

  getSessionAttendanceRecords: async (
    sessionId: string,
    query: SessionAttendanceQuery,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<unknown>> => {
    const session = await getSessionOrThrow(sessionId);
    await assertTeacherCanAccessSession(session.teacherId, currentUser);

    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const filter: FilterQuery<AttendanceRecord> = { sessionId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.remarks = new RegExp(query.search, 'i');
    }

    const [records, totalItems] = await Promise.all([
      AttendanceRecordModel.find(filter)
        .sort({ status: 1, lastSeenAt: -1, createdAt: 1 })
        .skip(skip)
        .limit(limit),
      AttendanceRecordModel.countDocuments(filter),
    ]);

    return {
      items: records.map((record) => record.toJSON()),
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  getSessionAttendanceSummary: async (
    sessionId: string,
    currentUser: AuthenticatedUser,
  ): Promise<unknown> => {
    const session = await getSessionOrThrow(sessionId);
    await assertTeacherCanAccessSession(session.teacherId, currentUser);

    const [summary, totalStudents, unknownFaceAlertCount] = await Promise.all([
      getAttendanceStatusSummary({ sessionId }),
      StudentModel.countDocuments({
        classGroupId: session.classGroupId,
        status: StudentStatus.ACTIVE,
      }),
      UnknownFaceAlertModel.countDocuments({ sessionId }),
    ]);

    const denominator =
      summary.totalRecords > 0 ? summary.totalRecords : totalStudents;

    return {
      session: session.toJSON(),
      totalStudents,
      recordsGenerated: summary.totalRecords,
      attendancePercentage: calculateAttendancePercentage(
        summary.attendedCount,
        denominator,
      ),
      presentCount: summary.presentCount,
      lateCount: summary.lateCount,
      absentCount: summary.absentCount,
      leftEarlyCount: summary.leftEarlyCount,
      unknownFaceAlertCount,
    };
  },

  getClassGroupAttendanceSummary: async (
    classGroupId: string,
    query: ClassGroupAttendanceSummaryQuery,
    currentUser: AuthenticatedUser,
  ): Promise<unknown> => {
    const classGroup = await ClassGroupModel.findById(classGroupId);

    if (!classGroup) {
      throw new AppError('Class group not found.', HTTP_STATUS.NOT_FOUND);
    }

    const sessionFilter = await buildScopedSessionFilter(
      currentUser,
      { classGroupId },
      query,
    );
    const [totalStudents, sessions] = await Promise.all([
      StudentModel.countDocuments({
        classGroupId,
        status: StudentStatus.ACTIVE,
      }),
      SessionModel.find(sessionFilter).select('_id').lean(),
    ]);

    const sessionIds = sessions.map((session) => session._id);

    if (sessionIds.length === 0) {
      return {
        classGroup: classGroup.toJSON(),
        from: query.from ?? null,
        to: query.to ?? null,
        totalSessions: 0,
        totalStudents,
        recordsGenerated: 0,
        attendancePercentage: 0,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        leftEarlyCount: 0,
        unknownFaceAlertCount: 0,
      };
    }

    const [summary, unknownFaceAlertCount] = await Promise.all([
      getAttendanceStatusSummary({
        sessionId: { $in: sessionIds },
      }),
      UnknownFaceAlertModel.countDocuments({
        sessionId: { $in: sessionIds },
      }),
    ]);

    const expectedRecords = totalStudents * sessions.length;
    const denominator =
      summary.totalRecords > 0 ? summary.totalRecords : expectedRecords;

    return {
      classGroup: classGroup.toJSON(),
      from: query.from ?? null,
      to: query.to ?? null,
      totalSessions: sessions.length,
      totalStudents,
      recordsGenerated: summary.totalRecords,
      attendancePercentage: calculateAttendancePercentage(
        summary.attendedCount,
        denominator,
      ),
      presentCount: summary.presentCount,
      lateCount: summary.lateCount,
      absentCount: summary.absentCount,
      leftEarlyCount: summary.leftEarlyCount,
      unknownFaceAlertCount,
    };
  },

  getStudentAttendanceHistory: async (
    studentId: string,
    query: StudentAttendanceHistoryQuery,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<unknown>> => {
    const studentExists = await StudentModel.exists({ _id: studentId });

    if (!studentExists) {
      throw new AppError('Student not found.', HTTP_STATUS.NOT_FOUND);
    }

    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const filter: FilterQuery<AttendanceRecord> = { studentId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.remarks = new RegExp(query.search, 'i');
    }

    if (query.from || query.to) {
      const sessionFilter = await buildScopedSessionFilter(currentUser, {}, query);
      const sessions = await SessionModel.find(sessionFilter).select('_id').lean();

      if (sessions.length === 0) {
        return {
          items: [],
          meta: buildPaginationMeta(0, page, limit),
        };
      }

      filter.sessionId = { $in: sessions.map((session) => session._id) };
    }

    if (currentUser.role === UserRole.TEACHER) {
      const teacherProfileId = await getTeacherProfileIdForUser(currentUser);

      if (!teacherProfileId) {
        throw new AppError(
          'Teacher profile not found for the authenticated user.',
          HTTP_STATUS.FORBIDDEN,
        );
      }

      filter.teacherId = teacherProfileId;
    }

    const [records, totalItems] = await Promise.all([
      AttendanceRecordModel.find(filter)
        .sort({ finalizedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AttendanceRecordModel.countDocuments(filter),
    ]);

    return {
      items: records.map((record) => record.toJSON()),
      meta: buildPaginationMeta(totalItems, page, limit),
    };
  },

  getSessionAttendanceExport: async (
    sessionId: string,
    currentUser: AuthenticatedUser,
  ): Promise<ExportPayload> => {
    const session = await getSessionOrThrow(sessionId);
    await assertTeacherCanAccessSession(session.teacherId, currentUser);

    const [summary, rows] = await Promise.all([
      attendanceService.getSessionAttendanceSummary(sessionId, currentUser) as Promise<
        Record<string, unknown>
      >,
      AttendanceRecordModel.aggregate<Record<string, unknown>>([
        {
          $match: {
            sessionId: session._id,
          },
        },
        {
          $lookup: {
            from: 'students',
            localField: 'studentId',
            foreignField: '_id',
            as: 'student',
          },
        },
        {
          $unwind: {
            path: '$student',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            fullName: {
              $trim: {
                input: {
                  $concat: ['$student.firstName', ' ', '$student.lastName'],
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            attendanceRecordId: { $toString: '$_id' },
            studentId: { $toString: '$studentId' },
            fullName: 1,
            rollNumber: '$student.rollNumber',
            email: '$student.email',
            status: 1,
            firstSeenAt: 1,
            lastSeenAt: 1,
            totalPresenceMinutes: 1,
            attendancePercentageInSession: 1,
            confidenceAverage: 1,
            eventCount: 1,
            finalizedAt: 1,
            remarks: 1,
          },
        },
        {
          $sort: {
            rollNumber: 1,
            fullName: 1,
          },
        },
      ]),
    ]);

    return {
      fileName: `session-attendance-${sessionId}`,
      columns: [
        { key: 'attendanceRecordId', label: 'Attendance Record ID' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'fullName', label: 'Full Name' },
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'email', label: 'Email' },
        { key: 'status', label: 'Status' },
        { key: 'firstSeenAt', label: 'First Seen At' },
        { key: 'lastSeenAt', label: 'Last Seen At' },
        { key: 'totalPresenceMinutes', label: 'Total Presence Minutes' },
        {
          key: 'attendancePercentageInSession',
          label: 'Attendance Percentage In Session',
        },
        { key: 'confidenceAverage', label: 'Confidence Average' },
        { key: 'eventCount', label: 'Event Count' },
        { key: 'finalizedAt', label: 'Finalized At' },
        { key: 'remarks', label: 'Remarks' },
      ],
      rows,
      summary,
    };
  },

  getStudentAttendanceExport: async (
    studentId: string,
    query: StudentAttendanceHistoryQuery,
    currentUser: AuthenticatedUser,
  ): Promise<ExportPayload> => {
    const student = await StudentModel.findById(studentId);

    if (!student) {
      throw new AppError('Student not found.', HTTP_STATUS.NOT_FOUND);
    }

    const filter: FilterQuery<AttendanceRecord> = {
      studentId: new Types.ObjectId(studentId),
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.from || query.to) {
      const sessionFilter = await buildScopedSessionFilter(currentUser, {}, query);
      const sessions = await SessionModel.find(sessionFilter).select('_id').lean();

      if (sessions.length === 0) {
        return {
          fileName: `student-attendance-${studentId}`,
          columns: [
            { key: 'attendanceRecordId', label: 'Attendance Record ID' },
            { key: 'sessionId', label: 'Session ID' },
            { key: 'sessionTitle', label: 'Session Title' },
            { key: 'scheduledDate', label: 'Scheduled Date' },
            { key: 'subjectCode', label: 'Subject Code' },
            { key: 'subjectName', label: 'Subject Name' },
            { key: 'status', label: 'Status' },
          ],
          rows: [],
          summary: {
            studentId,
            totalRecords: 0,
          },
        };
      }

      filter.sessionId = { $in: sessions.map((session) => session._id) };
    }

    if (currentUser.role === UserRole.TEACHER) {
      const teacherProfileId = await getTeacherProfileIdForUser(currentUser);

      if (!teacherProfileId) {
        throw new AppError(
          'Teacher profile not found for the authenticated user.',
          HTTP_STATUS.FORBIDDEN,
        );
      }

      filter.teacherId = new Types.ObjectId(teacherProfileId);
    }

    const rows = await AttendanceRecordModel.aggregate<Record<string, unknown>>([
      {
        $match: filter,
      },
      {
        $lookup: {
          from: 'sessions',
          localField: 'sessionId',
          foreignField: '_id',
          as: 'session',
        },
      },
      { $unwind: '$session' },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjectId',
          foreignField: '_id',
          as: 'subject',
        },
      },
      {
        $unwind: {
          path: '$subject',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          attendanceRecordId: { $toString: '$_id' },
          sessionId: { $toString: '$sessionId' },
          sessionTitle: '$session.title',
          scheduledDate: '$session.scheduledDate',
          scheduledStartTime: '$session.scheduledStartTime',
          scheduledEndTime: '$session.scheduledEndTime',
          subjectCode: '$subject.code',
          subjectName: '$subject.name',
          status: 1,
          firstSeenAt: 1,
          lastSeenAt: 1,
          totalPresenceMinutes: 1,
          attendancePercentageInSession: 1,
          confidenceAverage: 1,
          eventCount: 1,
          finalizedAt: 1,
          remarks: 1,
        },
      },
      {
        $sort: {
          scheduledDate: -1,
          scheduledStartTime: -1,
        },
      },
    ]);

    const attendedCount = rows.filter((row) => row.status !== AttendanceStatus.ABSENT).length;

    return {
      fileName: `student-attendance-${studentId}`,
      columns: [
        { key: 'attendanceRecordId', label: 'Attendance Record ID' },
        { key: 'sessionId', label: 'Session ID' },
        { key: 'sessionTitle', label: 'Session Title' },
        { key: 'scheduledDate', label: 'Scheduled Date' },
        { key: 'scheduledStartTime', label: 'Scheduled Start Time' },
        { key: 'scheduledEndTime', label: 'Scheduled End Time' },
        { key: 'subjectCode', label: 'Subject Code' },
        { key: 'subjectName', label: 'Subject Name' },
        { key: 'status', label: 'Status' },
        { key: 'firstSeenAt', label: 'First Seen At' },
        { key: 'lastSeenAt', label: 'Last Seen At' },
        { key: 'totalPresenceMinutes', label: 'Total Presence Minutes' },
        {
          key: 'attendancePercentageInSession',
          label: 'Attendance Percentage In Session',
        },
        { key: 'confidenceAverage', label: 'Confidence Average' },
        { key: 'eventCount', label: 'Event Count' },
        { key: 'finalizedAt', label: 'Finalized At' },
        { key: 'remarks', label: 'Remarks' },
      ],
      rows,
      summary: {
        studentId,
        totalRecords: rows.length,
        attendancePercentage: calculateAttendancePercentage(attendedCount, rows.length),
      },
    };
  },

  getClassGroupAttendanceExport: async (
    classGroupId: string,
    query: ClassGroupAttendanceSummaryQuery,
    currentUser: AuthenticatedUser,
  ): Promise<ExportPayload> => {
    const classGroup = await ClassGroupModel.findById(classGroupId);

    if (!classGroup) {
      throw new AppError('Class group not found.', HTTP_STATUS.NOT_FOUND);
    }

    const sessionFilter = await buildScopedSessionFilter(
      currentUser,
      { classGroupId },
      query,
    );
    const sessions = await SessionModel.find(sessionFilter).select('_id').lean();
    const summary = await attendanceService.getClassGroupAttendanceSummary(
      classGroupId,
      query,
      currentUser,
    ) as Record<string, unknown>;

    if (sessions.length === 0) {
      return {
        fileName: `class-group-attendance-${classGroupId}`,
        columns: [
          { key: 'studentId', label: 'Student ID' },
          { key: 'fullName', label: 'Full Name' },
          { key: 'rollNumber', label: 'Roll Number' },
          { key: 'email', label: 'Email' },
          { key: 'totalSessions', label: 'Total Sessions' },
          { key: 'attendedSessions', label: 'Attended Sessions' },
          { key: 'attendancePercentage', label: 'Attendance Percentage' },
        ],
        rows: [],
        summary,
      };
    }

    const rows = await AttendanceRecordModel.aggregate<Record<string, unknown>>([
      {
        $match: {
          sessionId: { $in: sessions.map((session) => session._id) },
        },
      },
      {
        $group: {
          _id: '$studentId',
          totalSessions: { $sum: 1 },
          attendedSessions: {
            $sum: {
              $cond: [{ $ne: ['$status', AttendanceStatus.ABSENT] }, 1, 0],
            },
          },
          presentCount: {
            $sum: {
              $cond: [{ $eq: ['$status', AttendanceStatus.PRESENT] }, 1, 0],
            },
          },
          lateCount: {
            $sum: {
              $cond: [{ $eq: ['$status', AttendanceStatus.LATE] }, 1, 0],
            },
          },
          absentCount: {
            $sum: {
              $cond: [{ $eq: ['$status', AttendanceStatus.ABSENT] }, 1, 0],
            },
          },
          leftEarlyCount: {
            $sum: {
              $cond: [{ $eq: ['$status', AttendanceStatus.LEFT_EARLY] }, 1, 0],
            },
          },
        },
      },
      {
        $addFields: {
          attendancePercentage: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      '$attendedSessions',
                      {
                        $cond: [
                          { $gt: ['$totalSessions', 0] },
                          '$totalSessions',
                          1,
                        ],
                      },
                    ],
                  },
                  100,
                ],
              },
              2,
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: '$student' },
      {
        $addFields: {
          fullName: {
            $trim: {
              input: {
                $concat: ['$student.firstName', ' ', '$student.lastName'],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          studentId: { $toString: '$_id' },
          fullName: 1,
          rollNumber: '$student.rollNumber',
          email: '$student.email',
          totalSessions: 1,
          attendedSessions: 1,
          attendancePercentage: 1,
          presentCount: 1,
          lateCount: 1,
          absentCount: 1,
          leftEarlyCount: 1,
        },
      },
      {
        $sort: {
          attendancePercentage: 1,
          rollNumber: 1,
        },
      },
    ]);

    return {
      fileName: `class-group-attendance-${classGroupId}`,
      columns: [
        { key: 'studentId', label: 'Student ID' },
        { key: 'fullName', label: 'Full Name' },
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'email', label: 'Email' },
        { key: 'totalSessions', label: 'Total Sessions' },
        { key: 'attendedSessions', label: 'Attended Sessions' },
        { key: 'attendancePercentage', label: 'Attendance Percentage' },
        { key: 'presentCount', label: 'Present Count' },
        { key: 'lateCount', label: 'Late Count' },
        { key: 'absentCount', label: 'Absent Count' },
        { key: 'leftEarlyCount', label: 'Left Early Count' },
      ],
      rows,
      summary,
    };
  },
};
