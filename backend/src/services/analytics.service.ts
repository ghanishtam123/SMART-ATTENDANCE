import { FilterQuery, PipelineStage, Types } from 'mongoose';

import { AttendanceStatus } from '../constants/attendance';
import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import AttendanceRecordModel from '../models/AttendanceRecord.model';
import SessionModel, { Session } from '../models/Session.model';
import TeacherProfileModel from '../models/TeacherProfile.model';
import UnknownFaceAlertModel from '../models/UnknownFaceAlert.model';
import { AuthenticatedUser } from '../types/auth.types';
import { PaginatedResult } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';
import { ExportPayload } from '../utils/export';

interface DateRangeQuery {
  from?: string;
  to?: string;
}

interface AttendanceOverviewQuery extends DateRangeQuery {
  classGroupId?: string;
}

interface LowAttendanceQuery extends DateRangeQuery {
  page?: number;
  limit?: number;
  search?: string;
  classGroupId?: string;
  threshold?: number;
}

interface LateEntriesQuery extends DateRangeQuery {
  page?: number;
  limit?: number;
  search?: string;
  classGroupId?: string;
}

interface SessionAbsenteesQuery {
  page?: number;
  limit?: number;
  search?: string;
}

interface AttendanceOverviewSummary {
  totalRecords: number;
  attendedCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  leftEarlyCount: number;
  uniqueStudentIds: Types.ObjectId[];
}

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

const calculateAttendancePercentage = (
  attendedCount: number,
  totalCount: number,
): number => {
  if (totalCount <= 0) {
    return 0;
  }

  return roundTo((attendedCount / totalCount) * 100);
};

const getTeacherProfileIdOrThrow = async (
  currentUser: AuthenticatedUser,
): Promise<Types.ObjectId | null> => {
  if (currentUser.role !== UserRole.TEACHER) {
    return null;
  }

  const teacherProfile = (await TeacherProfileModel.findOne({
    userId: currentUser.userId,
  })
    .select('_id')
    .lean()) as { _id: Types.ObjectId } | null;

  if (!teacherProfile) {
    throw new AppError(
      'Teacher profile not found for the authenticated user.',
      HTTP_STATUS.FORBIDDEN,
    );
  }

  return teacherProfile._id;
};

const buildScopedSessionFilter = async (
  currentUser: AuthenticatedUser,
  baseFilter: FilterQuery<Session>,
  query?: DateRangeQuery,
): Promise<FilterQuery<Session>> => {
  const filter: FilterQuery<Session> = { ...baseFilter };

  if (query?.from || query?.to) {
    filter.scheduledDate = {
      ...(query.from ? { $gte: getDateStart(query.from) } : {}),
      ...(query.to ? { $lt: getNextDateStart(query.to) } : {}),
    };
  }

  const teacherProfileId = await getTeacherProfileIdOrThrow(currentUser);

  if (teacherProfileId) {
    filter.teacherId = teacherProfileId;
  }

  return filter;
};

const getScopedSessions = async (
  currentUser: AuthenticatedUser,
  baseFilter: FilterQuery<Session>,
  query?: DateRangeQuery,
) => {
  const sessionFilter = await buildScopedSessionFilter(currentUser, baseFilter, query);
  const sessions = await SessionModel.find(sessionFilter)
    .select('_id title scheduledDate teacherId')
    .lean();

  return sessions as unknown as Array<{
    _id: Types.ObjectId;
    title?: string;
    scheduledDate?: Date;
    teacherId: Types.ObjectId;
  }>;
};

const getSessionOrThrow = async (sessionId: string) => {
  const session = await SessionModel.findById(sessionId);

  if (!session) {
    throw new AppError('Session not found.', HTTP_STATUS.NOT_FOUND);
  }

  return session;
};

const assertTeacherCanAccessSession = async (
  sessionTeacherId: Types.ObjectId,
  currentUser: AuthenticatedUser,
): Promise<void> => {
  if (currentUser.role !== UserRole.TEACHER) {
    return;
  }

  const teacherProfileId = await getTeacherProfileIdOrThrow(currentUser);

  if (!teacherProfileId || String(teacherProfileId) !== String(sessionTeacherId)) {
    throw new AppError(
      'You can only access analytics for your own sessions.',
      HTTP_STATUS.FORBIDDEN,
    );
  }
};

const getOverviewSummary = async (
  sessionIds: Types.ObjectId[],
): Promise<AttendanceOverviewSummary> => {
  const [summary] = await AttendanceRecordModel.aggregate<AttendanceOverviewSummary>([
    {
      $match: {
        sessionId: { $in: sessionIds },
      },
    },
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
        uniqueStudentIds: {
          $addToSet: '$studentId',
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
        uniqueStudentIds: 1,
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
      uniqueStudentIds: [],
    }
  );
};

const buildPaginatedAggregateResult = <T extends object>(
  aggregationResult: Array<{
    items: T[];
    totalCount: Array<{ count: number }>;
  }>,
  page: number,
  limit: number,
): PaginatedResult<T> => {
  const firstResult = aggregationResult[0] ?? { items: [], totalCount: [] };
  const totalItems = firstResult.totalCount[0]?.count ?? 0;

  return {
    items: firstResult.items,
    meta: buildPaginationMeta(totalItems, page, limit),
  };
};

export const analyticsService = {
  getAttendanceOverview: async (
    query: AttendanceOverviewQuery,
    currentUser: AuthenticatedUser,
  ): Promise<unknown> => {
    const sessions = await getScopedSessions(
      currentUser,
      {
        ...(query.classGroupId
          ? { classGroupId: new Types.ObjectId(query.classGroupId) }
          : {}),
      },
      query,
    );

    if (sessions.length === 0) {
      return {
        from: query.from ?? null,
        to: query.to ?? null,
        totalSessions: 0,
        totalStudents: 0,
        attendancePercentage: 0,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        leftEarlyCount: 0,
        unknownFaceAlertCount: 0,
      };
    }

    const sessionIds = sessions.map((session) => session._id);
    const [summary, unknownFaceAlertCount] = await Promise.all([
      getOverviewSummary(sessionIds),
      UnknownFaceAlertModel.countDocuments({ sessionId: { $in: sessionIds } }),
    ]);

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      totalSessions: sessions.length,
      totalStudents: summary.uniqueStudentIds.length,
      attendancePercentage: calculateAttendancePercentage(
        summary.attendedCount,
        summary.totalRecords,
      ),
      presentCount: summary.presentCount,
      lateCount: summary.lateCount,
      absentCount: summary.absentCount,
      leftEarlyCount: summary.leftEarlyCount,
      unknownFaceAlertCount,
    };
  },

  getLowAttendanceStudents: async (
    query: LowAttendanceQuery,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<unknown>> => {
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const threshold = query.threshold ?? 75;
    const sessions = await getScopedSessions(
      currentUser,
      {
        ...(query.classGroupId
          ? { classGroupId: new Types.ObjectId(query.classGroupId) }
          : {}),
      },
      query,
    );

    if (sessions.length === 0) {
      return {
        items: [],
        meta: buildPaginationMeta(0, page, limit),
      };
    }

    const searchRegex = query.search ? new RegExp(query.search, 'i') : null;
    const sessionIds = sessions.map((session) => session._id);
    const pipeline: PipelineStage[] = [
      {
        $match: {
          sessionId: { $in: sessionIds },
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
        $match: {
          attendancePercentage: { $lt: threshold },
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
      {
        $unwind: '$student',
      },
      {
        $lookup: {
          from: 'classgroups',
          localField: 'student.classGroupId',
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
                $concat: ['$student.firstName', ' ', '$student.lastName'],
              },
            },
          },
        },
      },
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { fullName: searchRegex },
                  { 'student.rollNumber': searchRegex },
                  { 'student.email': searchRegex },
                  { 'classGroup.code': searchRegex },
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
          rollNumber: '$student.rollNumber',
          email: '$student.email',
          totalSessions: 1,
          attendedSessions: 1,
          absentSessions: '$absentCount',
          presentCount: 1,
          lateCount: 1,
          leftEarlyCount: 1,
          attendancePercentage: 1,
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
        },
      },
      {
        $sort: {
          attendancePercentage: 1,
          absentSessions: -1,
          lateCount: -1,
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

    const result = await AttendanceRecordModel.aggregate(pipeline);

    return buildPaginatedAggregateResult(result, page, limit);
  },

  getLateEntries: async (
    query: LateEntriesQuery,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<unknown>> => {
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const sessions = await getScopedSessions(
      currentUser,
      {
        ...(query.classGroupId
          ? { classGroupId: new Types.ObjectId(query.classGroupId) }
          : {}),
      },
      query,
    );

    if (sessions.length === 0) {
      return {
        items: [],
        meta: buildPaginationMeta(0, page, limit),
      };
    }

    const searchRegex = query.search ? new RegExp(query.search, 'i') : null;
    const sessionIds = sessions.map((session) => session._id);
    const pipeline: PipelineStage[] = [
      {
        $match: {
          sessionId: { $in: sessionIds },
          firstSeenAt: { $ne: null },
        },
      },
      {
        $lookup: {
          from: 'sessions',
          localField: 'sessionId',
          foreignField: '_id',
          as: 'session',
        },
      },
      {
        $unwind: '$session',
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
        $unwind: '$student',
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
        $addFields: {
          scheduledStartAt: {
            $dateFromString: {
              dateString: {
                $concat: [
                  {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$session.scheduledDate',
                      timezone: 'UTC',
                    },
                  },
                  'T',
                  '$session.scheduledStartTime',
                  ':00.000Z',
                ],
              },
            },
          },
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
        $addFields: {
          effectiveStartAt: {
            $ifNull: ['$session.actualStartTime', '$scheduledStartAt'],
          },
        },
      },
      {
        $addFields: {
          lateThresholdAt: {
            $dateAdd: {
              startDate: '$effectiveStartAt',
              unit: 'minute',
              amount: '$session.graceMinutesForLate',
            },
          },
        },
      },
      {
        $match: {
          $expr: {
            $gt: ['$firstSeenAt', '$lateThresholdAt'],
          },
        },
      },
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { fullName: searchRegex },
                  { 'student.rollNumber': searchRegex },
                  { 'session.title': searchRegex },
                  { 'subject.code': searchRegex },
                  { 'classGroup.code': searchRegex },
                ],
              },
            },
          ]
        : []),
      {
        $addFields: {
          lateByMinutes: {
            $round: [
              {
                $divide: [
                  { $subtract: ['$firstSeenAt', '$lateThresholdAt'] },
                  60000,
                ],
              },
              2,
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          attendanceRecordId: { $toString: '$_id' },
          sessionId: { $toString: '$sessionId' },
          studentId: { $toString: '$studentId' },
          fullName: 1,
          rollNumber: '$student.rollNumber',
          sessionTitle: '$session.title',
          scheduledDate: '$session.scheduledDate',
          scheduledStartTime: '$session.scheduledStartTime',
          firstSeenAt: 1,
          lateThresholdAt: 1,
          lateByMinutes: 1,
          finalStatus: '$status',
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
          subject: {
            id: {
              $cond: [
                { $ifNull: ['$subject._id', false] },
                { $toString: '$subject._id' },
                null,
              ],
            },
            name: '$subject.name',
            code: '$subject.code',
          },
        },
      },
      {
        $sort: {
          scheduledDate: -1,
          lateByMinutes: -1,
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

    const result = await AttendanceRecordModel.aggregate(pipeline);

    return buildPaginatedAggregateResult(result, page, limit);
  },

  getSessionAbsentees: async (
    sessionId: string,
    query: SessionAbsenteesQuery,
    currentUser: AuthenticatedUser,
  ): Promise<{ session: unknown; items: unknown[]; meta: PaginatedResult<unknown>['meta'] }> => {
    const session = await getSessionOrThrow(sessionId);
    await assertTeacherCanAccessSession(session.teacherId, currentUser);

    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const searchRegex = query.search ? new RegExp(query.search, 'i') : null;
    const pipeline: PipelineStage[] = [
      {
        $match: {
          sessionId: session._id,
          status: AttendanceStatus.ABSENT,
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
        $unwind: '$student',
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
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { fullName: searchRegex },
                  { 'student.rollNumber': searchRegex },
                  { 'student.email': searchRegex },
                ],
              },
            },
          ]
        : []),
      {
        $project: {
          _id: 0,
          attendanceRecordId: { $toString: '$_id' },
          studentId: { $toString: '$studentId' },
          fullName: 1,
          rollNumber: '$student.rollNumber',
          email: '$student.email',
          phone: '$student.phone',
          remarks: 1,
          finalizedAt: 1,
        },
      },
      {
        $sort: {
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

    const result = await AttendanceRecordModel.aggregate(pipeline);
    const paginatedResult = buildPaginatedAggregateResult(result, page, limit);

    return {
      session: session.toJSON(),
      items: paginatedResult.items,
      meta: paginatedResult.meta,
    };
  },

  exportAttendanceOverview: async (
    query: AttendanceOverviewQuery,
    currentUser: AuthenticatedUser,
  ): Promise<ExportPayload> => {
    const summary = await analyticsService.getAttendanceOverview(
      query,
      currentUser,
    ) as Record<string, unknown>;

    return {
      fileName: 'attendance-overview',
      columns: [
        { key: 'from', label: 'From' },
        { key: 'to', label: 'To' },
        { key: 'totalSessions', label: 'Total Sessions' },
        { key: 'totalStudents', label: 'Total Students' },
        { key: 'attendancePercentage', label: 'Attendance Percentage' },
        { key: 'presentCount', label: 'Present Count' },
        { key: 'lateCount', label: 'Late Count' },
        { key: 'absentCount', label: 'Absent Count' },
        { key: 'leftEarlyCount', label: 'Left Early Count' },
        { key: 'unknownFaceAlertCount', label: 'Unknown Face Alert Count' },
      ],
      rows: [summary],
      summary,
    };
  },
};
