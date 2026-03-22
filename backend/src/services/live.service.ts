import { Types } from 'mongoose';

import { AttendanceStatus } from '../constants/attendance';
import { HTTP_STATUS } from '../constants/http';
import { UserRole } from '../constants/roles';
import { ACTIVE_SESSION_STATUSES } from '../constants/session';
import AttendanceEventModel from '../models/AttendanceEvent.model';
import AttendanceRecordModel from '../models/AttendanceRecord.model';
import SessionModel from '../models/Session.model';
import TeacherProfileModel from '../models/TeacherProfile.model';
import UnknownFaceAlertModel from '../models/UnknownFaceAlert.model';
import { AuthenticatedUser } from '../types/auth.types';
import { AppError } from '../utils/AppError';

interface ActiveSessionsQuery {
  limit?: number;
}

interface RecentItemsQuery {
  limit?: number;
}

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

const getSessionOrThrow = async (sessionId: string) => {
  const session = await SessionModel.findById(sessionId);

  if (!session) {
    throw new AppError('Session not found.', HTTP_STATUS.NOT_FOUND);
  }

  return session;
};

const assertTeacherCanAccessSession = async (
  sessionTeacherId: unknown,
  currentUser: AuthenticatedUser,
) => {
  if (currentUser.role !== UserRole.TEACHER) {
    return;
  }

  const teacherProfileId = await getTeacherProfileIdOrThrow(currentUser);

  if (!teacherProfileId || teacherProfileId !== String(sessionTeacherId)) {
    throw new AppError(
      'You can only access live data for your own sessions.',
      HTTP_STATUS.FORBIDDEN,
    );
  }
};

export const liveService = {
  getActiveSessions: async (
    query: ActiveSessionsQuery,
    currentUser: AuthenticatedUser,
  ): Promise<unknown[]> => {
    const limit = query.limit ?? 10;
    const teacherProfileId = await getTeacherProfileIdOrThrow(currentUser);
    const sessions = await SessionModel.find({
      status: { $in: ACTIVE_SESSION_STATUSES },
      ...(teacherProfileId ? { teacherId: new Types.ObjectId(teacherProfileId) } : {}),
    })
      .sort({ actualStartTime: -1, scheduledDate: -1, scheduledStartTime: -1 })
      .limit(limit);

    if (sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map((session) => session._id);
    const [eventCounts, alertCounts, recordCounts] = await Promise.all([
      AttendanceEventModel.aggregate<{ _id: Types.ObjectId; totalEvents: number }>([
        { $match: { sessionId: { $in: sessionIds } } },
        { $group: { _id: '$sessionId', totalEvents: { $sum: 1 } } },
      ]),
      UnknownFaceAlertModel.aggregate<{ _id: Types.ObjectId; totalAlerts: number }>([
        { $match: { sessionId: { $in: sessionIds } } },
        { $group: { _id: '$sessionId', totalAlerts: { $sum: 1 } } },
      ]),
      AttendanceRecordModel.aggregate<{ _id: Types.ObjectId; totalRecords: number }>([
        { $match: { sessionId: { $in: sessionIds } } },
        { $group: { _id: '$sessionId', totalRecords: { $sum: 1 } } },
      ]),
    ]);

    const eventCountMap = new Map(
      eventCounts.map((item) => [String(item._id), item.totalEvents]),
    );
    const alertCountMap = new Map(
      alertCounts.map((item) => [String(item._id), item.totalAlerts]),
    );
    const recordCountMap = new Map(
      recordCounts.map((item) => [String(item._id), item.totalRecords]),
    );

    return sessions.map((session) => ({
      ...session.toJSON(),
      liveCounters: {
        totalEvents: eventCountMap.get(session.id) ?? 0,
        unknownFaceAlerts: alertCountMap.get(session.id) ?? 0,
        attendanceRecords: recordCountMap.get(session.id) ?? 0,
      },
    }));
  },

  getSessionOverview: async (
    sessionId: string,
    currentUser: AuthenticatedUser,
  ): Promise<unknown> => {
    const session = await getSessionOrThrow(sessionId);
    await assertTeacherCanAccessSession(session.teacherId, currentUser);

    const [eventSummary, alertSummary, recordSummary] = await Promise.all([
      AttendanceEventModel.aggregate<{
        _id: null;
        totalEvents: number;
        recognizedEvents: number;
        unknownEvents: number;
        lastEventAt: Date | null;
      }>([
        { $match: { sessionId: session._id } },
        {
          $group: {
            _id: null,
            totalEvents: { $sum: 1 },
            recognizedEvents: {
              $sum: {
                $cond: [{ $eq: ['$isUnknown', false] }, 1, 0],
              },
            },
            unknownEvents: {
              $sum: {
                $cond: [{ $eq: ['$isUnknown', true] }, 1, 0],
              },
            },
            lastEventAt: { $max: '$eventTimestamp' },
          },
        },
      ]),
      UnknownFaceAlertModel.aggregate<{
        _id: null;
        totalAlerts: number;
        reviewedAlerts: number;
        pendingAlerts: number;
        lastAlertAt: Date | null;
      }>([
        { $match: { sessionId: session._id } },
        {
          $group: {
            _id: null,
            totalAlerts: { $sum: 1 },
            reviewedAlerts: {
              $sum: {
                $cond: [{ $eq: ['$reviewed', true] }, 1, 0],
              },
            },
            pendingAlerts: {
              $sum: {
                $cond: [{ $eq: ['$reviewed', false] }, 1, 0],
              },
            },
            lastAlertAt: { $max: '$detectedAt' },
          },
        },
      ]),
      AttendanceRecordModel.aggregate<{
        _id: null;
        totalRecords: number;
        presentCount: number;
        lateCount: number;
        absentCount: number;
        leftEarlyCount: number;
      }>([
        { $match: { sessionId: session._id } },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
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
      ]),
    ]);

    return {
      session: session.toJSON(),
      eventSummary: eventSummary[0] ?? {
        totalEvents: 0,
        recognizedEvents: 0,
        unknownEvents: 0,
        lastEventAt: null,
      },
      alertSummary: alertSummary[0] ?? {
        totalAlerts: 0,
        reviewedAlerts: 0,
        pendingAlerts: 0,
        lastAlertAt: null,
      },
      attendanceSummary: recordSummary[0] ?? {
        totalRecords: 0,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        leftEarlyCount: 0,
      },
    };
  },

  getRecentSessionEvents: async (
    sessionId: string,
    query: RecentItemsQuery,
    currentUser: AuthenticatedUser,
  ): Promise<unknown[]> => {
    const session = await getSessionOrThrow(sessionId);
    await assertTeacherCanAccessSession(session.teacherId, currentUser);

    return AttendanceEventModel.aggregate([
      { $match: { sessionId: session._id } },
      { $sort: { eventTimestamp: -1, createdAt: -1 } },
      { $limit: query.limit ?? 20 },
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
          eventId: { $toString: '$_id' },
          sessionId: { $toString: '$sessionId' },
          studentId: {
            $cond: [
              { $ifNull: ['$studentId', false] },
              { $toString: '$studentId' },
              null,
            ],
          },
          fullName: 1,
          rollNumber: '$student.rollNumber',
          cameraId: 1,
          isUnknown: 1,
          confidence: 1,
          eventTimestamp: 1,
          processed: 1,
          boundingBox: 1,
        },
      },
    ]);
  },

  getRecentSessionAlerts: async (
    sessionId: string,
    query: RecentItemsQuery,
    currentUser: AuthenticatedUser,
  ): Promise<unknown[]> => {
    const session = await getSessionOrThrow(sessionId);
    await assertTeacherCanAccessSession(session.teacherId, currentUser);

    const alerts = await UnknownFaceAlertModel.find({ sessionId: session._id })
      .sort({ detectedAt: -1, createdAt: -1 })
      .limit(query.limit ?? 20);

    return alerts.map((alert) => alert.toJSON());
  },
};
