import { PipelineStage, Types } from 'mongoose';

import { AttendanceStatus } from '../constants/attendance';
import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import AttendanceRecordModel from '../models/AttendanceRecord.model';
import ClassGroupModel from '../models/ClassGroup.model';
import FaceProfileModel from '../models/FaceProfile.model';
import SessionModel from '../models/Session.model';
import StudentModel from '../models/Student.model';
import UserModel from '../models/User.model';
import { AuthenticatedUser } from '../types/auth.types';
import { PaginatedResult } from '../types/common.types';
import { AppError } from '../utils/AppError';
import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../utils/pagination';
import { ExportPayload } from '../utils/export';
import { sanitizeUser } from './userAccount.service';

interface DateRangeQuery {
  from?: string;
  to?: string;
}

interface StudentPortalOverviewQuery extends DateRangeQuery {
  threshold?: number;
}

interface StudentPortalHistoryQuery extends DateRangeQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: AttendanceStatus;
}

interface StudentPortalSubjectsQuery extends DateRangeQuery {
  page?: number;
  limit?: number;
  search?: string;
  threshold?: number;
}

const roundTo = (value: number, precision = 2): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
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

const getDateStart = (dateValue: string): Date => {
  return new Date(`${dateValue}T00:00:00.000Z`);
};

const getNextDateStart = (dateValue: string): Date => {
  const nextDate = getDateStart(dateValue);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate;
};

const getCurrentStudentOrThrow = async (currentUser: AuthenticatedUser) => {
  if (currentUser.role !== UserRole.STUDENT || !currentUser.studentId) {
    throw new AppError(
      'Student access is required to access this resource.',
      HTTP_STATUS.FORBIDDEN,
    );
  }

  const student = await StudentModel.findById(currentUser.studentId);

  if (!student || String(student.userId) !== currentUser.userId) {
    throw new AppError(
      'Authenticated student profile is not available.',
      HTTP_STATUS.FORBIDDEN,
    );
  }

  return student;
};

const getDateScopedSessionIds = async (
  query: DateRangeQuery,
): Promise<Types.ObjectId[] | null> => {
  if (!query.from && !query.to) {
    return null;
  }

  const sessions = await SessionModel.find({
    scheduledDate: {
      ...(query.from ? { $gte: getDateStart(query.from) } : {}),
      ...(query.to ? { $lt: getNextDateStart(query.to) } : {}),
    },
  })
    .select('_id')
    .lean() as Array<{ _id: Types.ObjectId }>;

  return sessions.map((session) => session._id);
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

const buildAttendanceMatch = async (
  studentId: string,
  query: DateRangeQuery & { status?: AttendanceStatus },
) => {
  const match: Record<string, unknown> = {
    studentId: new Types.ObjectId(studentId),
  };

  if (query.status) {
    match.status = query.status;
  }

  const sessionIds = await getDateScopedSessionIds(query);

  if (sessionIds && sessionIds.length === 0) {
    return null;
  }

  if (sessionIds) {
    match.sessionId = { $in: sessionIds };
  }

  return match;
};

export const studentPortalService = {
  getMe: async (currentUser: AuthenticatedUser): Promise<unknown> => {
    const student = await getCurrentStudentOrThrow(currentUser);
    const [user, classGroup, faceProfile, overview] = await Promise.all([
      UserModel.findById(currentUser.userId),
      ClassGroupModel.findById(student.classGroupId),
      FaceProfileModel.findOne({ studentId: student._id }),
      studentPortalService.getAttendanceOverview(
        { threshold: 75 },
        currentUser,
      ),
    ]);

    if (!user) {
      throw new AppError(
        'Authenticated user is not available.',
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    return {
      user: sanitizeUser(user, student.id),
      student: student.toJSON(),
      classGroup: classGroup ? classGroup.toJSON() : null,
      faceProfile: faceProfile ? faceProfile.toJSON() : null,
      attendanceOverview: overview,
    };
  },

  getAttendanceOverview: async (
    query: StudentPortalOverviewQuery,
    currentUser: AuthenticatedUser,
  ): Promise<unknown> => {
    const student = await getCurrentStudentOrThrow(currentUser);
    const threshold = query.threshold ?? 75;
    const match = await buildAttendanceMatch(student.id, query);

    if (!match) {
      return {
        studentId: student.id,
        threshold,
        totalSessions: 0,
        attendedSessions: 0,
        attendancePercentage: 0,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        leftEarlyCount: 0,
        lowAttendanceStatus: {
          threshold,
          isLowAttendance: true,
        },
      };
    }

    const [summary] = await AttendanceRecordModel.aggregate<{
      totalSessions: number;
      attendedSessions: number;
      presentCount: number;
      lateCount: number;
      absentCount: number;
      leftEarlyCount: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
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
        $project: {
          _id: 0,
          totalSessions: 1,
          attendedSessions: 1,
          presentCount: 1,
          lateCount: 1,
          absentCount: 1,
          leftEarlyCount: 1,
        },
      },
    ]);

    const resolvedSummary = summary ?? {
      totalSessions: 0,
      attendedSessions: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      leftEarlyCount: 0,
    };
    const attendancePercentage = calculateAttendancePercentage(
      resolvedSummary.attendedSessions,
      resolvedSummary.totalSessions,
    );

    return {
      studentId: student.id,
      threshold,
      totalSessions: resolvedSummary.totalSessions,
      attendedSessions: resolvedSummary.attendedSessions,
      attendancePercentage,
      presentCount: resolvedSummary.presentCount,
      lateCount: resolvedSummary.lateCount,
      absentCount: resolvedSummary.absentCount,
      leftEarlyCount: resolvedSummary.leftEarlyCount,
      lowAttendanceStatus: {
        threshold,
        isLowAttendance: attendancePercentage < threshold,
      },
    };
  },

  getAttendanceHistory: async (
    query: StudentPortalHistoryQuery,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<unknown>> => {
    const student = await getCurrentStudentOrThrow(currentUser);
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const match = await buildAttendanceMatch(student.id, query);

    if (!match) {
      return {
        items: [],
        meta: buildPaginationMeta(0, page, limit),
      };
    }

    const searchRegex = query.search ? new RegExp(query.search, 'i') : null;
    const pipeline: PipelineStage[] = [
      { $match: match },
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
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { 'session.title': searchRegex },
                  { 'subject.name': searchRegex },
                  { 'subject.code': searchRegex },
                  { 'classGroup.code': searchRegex },
                  { remarks: searchRegex },
                ],
              },
            },
          ]
        : []),
      {
        $project: {
          _id: 0,
          attendanceRecordId: { $toString: '$_id' },
          sessionId: { $toString: '$sessionId' },
          status: 1,
          firstSeenAt: 1,
          lastSeenAt: 1,
          totalPresenceMinutes: 1,
          attendancePercentageInSession: 1,
          confidenceAverage: 1,
          eventCount: 1,
          finalizedAt: 1,
          remarks: 1,
          session: {
            id: { $toString: '$session._id' },
            title: '$session.title',
            scheduledDate: '$session.scheduledDate',
            scheduledStartTime: '$session.scheduledStartTime',
            scheduledEndTime: '$session.scheduledEndTime',
            status: '$session.status',
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
          'session.scheduledDate': -1,
          'session.scheduledStartTime': -1,
          finalizedAt: -1,
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

  getSubjectAttendance: async (
    query: StudentPortalSubjectsQuery,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<unknown>> => {
    const student = await getCurrentStudentOrThrow(currentUser);
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const threshold = query.threshold ?? 75;
    const match = await buildAttendanceMatch(student.id, query);

    if (!match) {
      return {
        items: [],
        meta: buildPaginationMeta(0, page, limit),
      };
    }

    const searchRegex = query.search ? new RegExp(query.search, 'i') : null;
    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $group: {
          _id: '$subjectId',
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
          from: 'subjects',
          localField: '_id',
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
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { 'subject.name': searchRegex },
                  { 'subject.code': searchRegex },
                  { 'subject.description': searchRegex },
                ],
              },
            },
          ]
        : []),
      {
        $project: {
          _id: 0,
          subjectId: {
            $cond: [
              { $ifNull: ['$subject._id', false] },
              { $toString: '$subject._id' },
              { $toString: '$_id' },
            ],
          },
          subject: {
            name: '$subject.name',
            code: '$subject.code',
            description: '$subject.description',
            creditHours: '$subject.creditHours',
          },
          totalSessions: 1,
          attendedSessions: 1,
          presentCount: 1,
          lateCount: 1,
          absentCount: 1,
          leftEarlyCount: 1,
          attendancePercentage: 1,
          lowAttendanceStatus: {
            threshold,
            isLowAttendance: { $lt: ['$attendancePercentage', threshold] },
          },
        },
      },
      {
        $sort: {
          attendancePercentage: 1,
          totalSessions: -1,
          'subject.code': 1,
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

  getSessionHistory: async (
    query: StudentPortalHistoryQuery,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<unknown>> => {
    const student = await getCurrentStudentOrThrow(currentUser);
    const { page, limit, skip } = getPaginationOptions(query.page, query.limit);
    const match = await buildAttendanceMatch(student.id, query);

    if (!match) {
      return {
        items: [],
        meta: buildPaginationMeta(0, page, limit),
      };
    }

    const searchRegex = query.search ? new RegExp(query.search, 'i') : null;
    const pipeline: PipelineStage[] = [
      { $match: match },
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
        $lookup: {
          from: 'classrooms',
          localField: 'session.classroomId',
          foreignField: '_id',
          as: 'classroom',
        },
      },
      {
        $unwind: {
          path: '$classroom',
          preserveNullAndEmptyArrays: true,
        },
      },
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { 'session.title': searchRegex },
                  { 'subject.name': searchRegex },
                  { 'subject.code': searchRegex },
                  { 'classroom.code': searchRegex },
                  { 'classroom.name': searchRegex },
                ],
              },
            },
          ]
        : []),
      {
        $project: {
          _id: 0,
          sessionId: { $toString: '$session._id' },
          attendanceRecordId: { $toString: '$_id' },
          title: '$session.title',
          scheduledDate: '$session.scheduledDate',
          scheduledStartTime: '$session.scheduledStartTime',
          scheduledEndTime: '$session.scheduledEndTime',
          sessionStatus: '$session.status',
          attendanceStatus: '$status',
          firstSeenAt: '$firstSeenAt',
          lastSeenAt: '$lastSeenAt',
          totalPresenceMinutes: '$totalPresenceMinutes',
          attendancePercentageInSession: '$attendancePercentageInSession',
          finalizedAt: '$finalizedAt',
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
          classroom: {
            id: {
              $cond: [
                { $ifNull: ['$classroom._id', false] },
                { $toString: '$classroom._id' },
                null,
              ],
            },
            name: '$classroom.name',
            code: '$classroom.code',
            building: '$classroom.building',
          },
        },
      },
      {
        $sort: {
          scheduledDate: -1,
          scheduledStartTime: -1,
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

  exportAttendanceHistory: async (
    query: StudentPortalHistoryQuery,
    currentUser: AuthenticatedUser,
  ): Promise<ExportPayload> => {
    const student = await getCurrentStudentOrThrow(currentUser);
    const match = await buildAttendanceMatch(student.id, query);

    if (!match) {
      return {
        fileName: `student-self-attendance-${student.id}`,
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
          studentId: student.id,
          totalRecords: 0,
        },
      };
    }

    const searchRegex = query.search ? new RegExp(query.search, 'i') : null;
    const rows = await AttendanceRecordModel.aggregate<Record<string, unknown>>([
      { $match: match },
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
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { 'session.title': searchRegex },
                  { 'subject.name': searchRegex },
                  { 'subject.code': searchRegex },
                  { remarks: searchRegex },
                ],
              },
            },
          ]
        : []),
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
      fileName: `student-self-attendance-${student.id}`,
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
        studentId: student.id,
        totalRecords: rows.length,
        attendancePercentage: calculateAttendancePercentage(attendedCount, rows.length),
      },
    };
  },
};
