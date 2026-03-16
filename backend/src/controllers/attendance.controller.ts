import { HTTP_STATUS } from '../constants/http';
import { buildAuditContext } from '../services/audit.service';
import { attendanceService } from '../services/attendance.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

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

export const attendanceController = {
  recalculateSessionAttendance,
  finalizeSessionAttendance,
  getSessionAttendanceRecords,
  getSessionAttendanceSummary,
  getClassGroupAttendanceSummary,
  getStudentAttendanceHistory,
};
