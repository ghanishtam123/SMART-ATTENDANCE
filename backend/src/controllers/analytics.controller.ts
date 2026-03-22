import { analyticsService } from '../services/analytics.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { sendExportResponse } from '../utils/export';

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

const exportAttendanceOverview = asyncHandler(async (req, res) => {
  const result = await analyticsService.exportAttendanceOverview(req.query, req.user!);

  return sendExportResponse(
    res,
    req.query.format as 'json' | 'csv',
    'Attendance overview export prepared successfully.',
    result,
  );
});

export const analyticsController = {
  getAttendanceOverview,
  getLowAttendanceStudents,
  getLateEntries,
  getSessionAbsentees,
  exportAttendanceOverview,
};
