import { HTTP_STATUS } from '../constants/http';
import { aiRecognitionService } from '../services/aiRecognition.service';
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

export const aiController = {
  ingestRecognitionEvents,
};
