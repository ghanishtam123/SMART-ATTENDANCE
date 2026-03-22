import { studentPortalService } from '../services/studentPortal.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { sendExportResponse } from '../utils/export';

const getMe = asyncHandler(async (req, res) => {
  const result = await studentPortalService.getMe(req.user!);

  return ApiResponse.success(res, {
    message: 'Student portal profile fetched successfully.',
    data: result,
  });
});

const getAttendanceOverview = asyncHandler(async (req, res) => {
  const result = await studentPortalService.getAttendanceOverview(req.query, req.user!);

  return ApiResponse.success(res, {
    message: 'Student attendance overview fetched successfully.',
    data: result,
  });
});

const getAttendanceHistory = asyncHandler(async (req, res) => {
  const result = await studentPortalService.getAttendanceHistory(req.query, req.user!);

  return ApiResponse.success(res, {
    message: 'Student attendance history fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getSubjects = asyncHandler(async (req, res) => {
  const result = await studentPortalService.getSubjectAttendance(req.query, req.user!);

  return ApiResponse.success(res, {
    message: 'Student subject-wise attendance fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getSessionHistory = asyncHandler(async (req, res) => {
  const result = await studentPortalService.getSessionHistory(req.query, req.user!);

  return ApiResponse.success(res, {
    message: 'Student session history fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const exportAttendanceHistory = asyncHandler(async (req, res) => {
  const result = await studentPortalService.exportAttendanceHistory(
    req.query,
    req.user!,
  );

  return sendExportResponse(
    res,
    req.query.format as 'json' | 'csv',
    'Student attendance export prepared successfully.',
    result,
  );
});

export const studentPortalController = {
  getMe,
  getAttendanceOverview,
  getAttendanceHistory,
  getSubjects,
  getSessionHistory,
  exportAttendanceHistory,
};
