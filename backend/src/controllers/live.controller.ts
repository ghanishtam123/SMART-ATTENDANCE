import { liveService } from '../services/live.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const getActiveSessions = asyncHandler(async (req, res) => {
  const result = await liveService.getActiveSessions(req.query, req.user!);

  return ApiResponse.success(res, {
    message: 'Active sessions fetched successfully.',
    data: result,
  });
});

const getSessionOverview = asyncHandler(async (req, res) => {
  const result = await liveService.getSessionOverview(
    String(req.params.sessionId),
    req.user!,
  );

  return ApiResponse.success(res, {
    message: 'Live session overview fetched successfully.',
    data: result,
  });
});

const getRecentSessionEvents = asyncHandler(async (req, res) => {
  const result = await liveService.getRecentSessionEvents(
    String(req.params.sessionId),
    req.query,
    req.user!,
  );

  return ApiResponse.success(res, {
    message: 'Recent session events fetched successfully.',
    data: result,
  });
});

const getRecentSessionAlerts = asyncHandler(async (req, res) => {
  const result = await liveService.getRecentSessionAlerts(
    String(req.params.sessionId),
    req.query,
    req.user!,
  );

  return ApiResponse.success(res, {
    message: 'Recent session alerts fetched successfully.',
    data: result,
  });
});

export const liveController = {
  getActiveSessions,
  getSessionOverview,
  getRecentSessionEvents,
  getRecentSessionAlerts,
};
