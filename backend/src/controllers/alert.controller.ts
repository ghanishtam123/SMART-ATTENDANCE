import { HTTP_STATUS } from '../constants/http';
import { buildAuditContext } from '../services/audit.service';
import { alertService } from '../services/alert.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const listUnknownFaceAlerts = asyncHandler(async (req, res) => {
  const result = await alertService.listUnknownFaceAlerts(req.query);

  return ApiResponse.success(res, {
    message: 'Unknown face alerts fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const markUnknownFaceAlertReviewed = asyncHandler(async (req, res) => {
  const result = await alertService.markUnknownFaceAlertReviewed(
    String(req.params.id),
    req.body,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.ACCEPTED,
    message: 'Unknown face alert marked as reviewed.',
    data: result,
  });
});

export const alertController = {
  listUnknownFaceAlerts,
  markUnknownFaceAlertReviewed,
};
