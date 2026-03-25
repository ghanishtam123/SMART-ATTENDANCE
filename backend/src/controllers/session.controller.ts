import { HTTP_STATUS } from '../constants/http';
import { buildAuditContext } from '../services/audit.service';
import { sessionService } from '../services/session.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const listSessions = asyncHandler(async (req, res) => {
  const result = await sessionService.listSessions(req.query);

  return ApiResponse.success(res, {
    message: 'Sessions fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getSessionById = asyncHandler(async (req, res) => {
  const result = await sessionService.getSessionById(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Session fetched successfully.',
    data: result,
  });
});

const createSession = asyncHandler(async (req, res) => {
  const result = await sessionService.createSession(req.body);

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Session created successfully.',
    data: result,
  });
});

const createSessionFromTimetable = asyncHandler(async (req, res) => {
  const result = await sessionService.createStartedSessionFromTimetable(
    String(req.body.timetableEntryId),
    req.user!,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    message: 'Session started from timetable successfully.',
    data: result,
  });
});

const updateSession = asyncHandler(async (req, res) => {
  const result = await sessionService.updateSession(String(req.params.id), req.body);

  return ApiResponse.success(res, {
    message: 'Session updated successfully.',
    data: result,
  });
});

const deleteSession = asyncHandler(async (req, res) => {
  const result = await sessionService.deleteSession(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Session deleted successfully.',
    data: result,
  });
});

const startSession = asyncHandler(async (req, res) => {
  const result = await sessionService.startSession(
    String(req.params.id),
    req.user!,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.ACCEPTED,
    message: 'Session lifecycle updated successfully.',
    data: result,
  });
});

const completeSession = asyncHandler(async (req, res) => {
  const result = await sessionService.completeSession(
    String(req.params.id),
    req.user!,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.ACCEPTED,
    message: 'Session completed successfully.',
    data: result,
  });
});

const archiveSession = asyncHandler(async (req, res) => {
  const result = await sessionService.archiveSession(
    String(req.params.id),
    req.user!,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.ACCEPTED,
    message: 'Session archived successfully.',
    data: result,
  });
});

export const sessionController = {
  listSessions,
  getSessionById,
  createSession,
  createSessionFromTimetable,
  updateSession,
  deleteSession,
  startSession,
  completeSession,
  archiveSession,
};
