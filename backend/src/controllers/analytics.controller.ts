import { analyticsService } from '../services/analytics.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const getAttendanceOverview = asyncHandler(async (req, res) => {
  const result = await analyticsService.getAttendanceOverview(req.query, req.user!);

  return ApiResponse.success(res, {
    message: 'Attendance overview fetched successfully.',
    data: result,
  });
});

const getLowAttendanceStudents = asyncHandler(async (req, res) => {
  const result = await analyticsService.getLowAttendanceStudents(
    req.query,
    req.user!,
  );

  return ApiResponse.success(res, {
    message: 'Low attendance students fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getLateEntries = asyncHandler(async (req, res) => {
  const result = await analyticsService.getLateEntries(req.query, req.user!);

  return ApiResponse.success(res, {
    message: 'Late entries fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getSessionAbsentees = asyncHandler(async (req, res) => {
  const result = await analyticsService.getSessionAbsentees(
    String(req.params.sessionId),
    req.query,
    req.user!,
  );

  return ApiResponse.success(res, {
    message: 'Session absentees fetched successfully.',
    data: result.items,
    meta: {
      ...result.meta,
      session: result.session,
    },
  });
});

export const analyticsController = {
  getAttendanceOverview,
  getLowAttendanceStudents,
  getLateEntries,
  getSessionAbsentees,
};
