import { HTTP_STATUS } from '../constants/http';
import { buildAuditContext } from '../services/audit.service';
import { faceProfileService } from '../services/faceProfile.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const getFaceProfileByStudent = asyncHandler(async (req, res) => {
  const result = await faceProfileService.getFaceProfileByStudentId(
    String(req.params.studentId),
  );

  return ApiResponse.success(res, {
    message: 'Face profile fetched successfully.',
    data: result,
  });
});

const createFaceProfile = asyncHandler(async (req, res) => {
  const result = await faceProfileService.createFaceProfile(
    req.body,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Face profile created successfully.',
    data: result,
  });
});

const updateFaceProfile = asyncHandler(async (req, res) => {
  const result = await faceProfileService.updateFaceProfile(
    String(req.params.id),
    req.body,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    message: 'Face profile updated successfully.',
    data: result,
  });
});

const updateFaceProfileStatus = asyncHandler(async (req, res) => {
  const result = await faceProfileService.updateFaceProfileStatus(
    String(req.params.id),
    req.body,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    message: 'Face profile status updated successfully.',
    data: result,
  });
});

const getFaceProfileOverview = asyncHandler(async (req, res) => {
  const result = await faceProfileService.getFaceProfileOverview(req.query);

  return ApiResponse.success(res, {
    message: 'Face profile overview fetched successfully.',
    data: result.items,
    meta: {
      ...result.meta,
      counts: result.counts,
    },
  });
});

export const faceProfileController = {
  getFaceProfileByStudent,
  createFaceProfile,
  updateFaceProfile,
  updateFaceProfileStatus,
  getFaceProfileOverview,
};
