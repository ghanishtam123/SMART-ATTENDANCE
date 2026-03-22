import { HTTP_STATUS } from '../constants/http';
import { buildAuditContext } from '../services/audit.service';
import { attendanceService } from '../services/attendance.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { sendExportResponse } from '../utils/export';

const recalculateSessionAttendance = asyncHandler(async (req, res) => {
  const result = await attendanceService.recalculateSessionAttendance(
    String(req.params.sessionId),
    req.user!,
  );

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.ACCEPTED,
    message: 'Attendance records recalculated successfully.',
    data: result,
  });
});

const finalizeSessionAttendance = asyncHandler(async (req, res) => {
  const result = await attendanceService.finalizeSessionAttendance(
    String(req.params.sessionId),
    req.user!,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.ACCEPTED,
    message: 'Attendance records finalized successfully.',
    data: result,
  });
});

const getSessionAttendanceRecords = asyncHandler(async (req, res) => {
  const result = await attendanceService.getSessionAttendanceRecords(
    String(req.params.sessionId),
    req.query,
    req.user!,
  );

  return ApiResponse.success(res, {
    message: 'Session attendance records fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getSessionAttendanceSummary = asyncHandler(async (req, res) => {
  const result = await attendanceService.getSessionAttendanceSummary(
    String(req.params.sessionId),
    req.user!,
  );

  return ApiResponse.success(res, {
    message: 'Session attendance summary fetched successfully.',
    data: result,
  });
});

const getClassGroupAttendanceSummary = asyncHandler(async (req, res) => {
  const result = await attendanceService.getClassGroupAttendanceSummary(
    String(req.params.classGroupId),
    req.query,
    req.user!,
  );

  return ApiResponse.success(res, {
    message: 'Class group attendance summary fetched successfully.',
    data: result,
  });
});

const getStudentAttendanceHistory = asyncHandler(async (req, res) => {
  const result = await attendanceService.getStudentAttendanceHistory(
    String(req.params.studentId),
    req.query,
    req.user!,
  );

  return ApiResponse.success(res, {
    message: 'Student attendance history fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const exportSessionAttendanceRecords = asyncHandler(async (req, res) => {
  const result = await attendanceService.getSessionAttendanceExport(
    String(req.params.sessionId),
    req.user!,
  );

  return sendExportResponse(
    res,
    req.query.format as 'json' | 'csv',
    'Session attendance export prepared successfully.',
    result,
  );
});

const exportStudentAttendanceHistory = asyncHandler(async (req, res) => {
  const result = await attendanceService.getStudentAttendanceExport(
    String(req.params.studentId),
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

const exportClassGroupAttendanceSummary = asyncHandler(async (req, res) => {
  const result = await attendanceService.getClassGroupAttendanceExport(
    String(req.params.classGroupId),
    req.query,
    req.user!,
  );

  return sendExportResponse(
    res,
    req.query.format as 'json' | 'csv',
    'Class group attendance export prepared successfully.',
    result,
  );
});

export const attendanceController = {
  recalculateSessionAttendance,
  finalizeSessionAttendance,
  getSessionAttendanceRecords,
  getSessionAttendanceSummary,
  getClassGroupAttendanceSummary,
  getStudentAttendanceHistory,
  exportSessionAttendanceRecords,
  exportStudentAttendanceHistory,
  exportClassGroupAttendanceSummary,
};
