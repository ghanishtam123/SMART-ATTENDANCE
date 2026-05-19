import { HTTP_STATUS } from '../constants/http';
import { aiRecognitionService } from '../services/aiRecognition.service';
import { sessionService } from '../services/session.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const ingestRecognitionEvents = asyncHandler(async (req, res) => {
  const result = await aiRecognitionService.ingestRecognitionEvents(req.body);

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.ACCEPTED,
    message: 'Recognition events accepted successfully.',
    data: result,
  });
});

const getActiveSessionForAi = asyncHandler(async (req, res) => {
  const cameraId =
    typeof req.query.cameraId === 'string' ? req.query.cameraId : undefined;
  const result = await sessionService.getActiveSessionForAi(cameraId);

  return ApiResponse.success(res, {
    message: result
      ? 'Active session fetched successfully.'
      : 'No active session found.',
    data: result,
  });
});

export const aiController = {
  ingestRecognitionEvents,
  getActiveSessionForAi,
};
