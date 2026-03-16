import { HTTP_STATUS } from '../constants/http';
import { classGroupService } from '../services/classGroup.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const listClassGroups = asyncHandler(async (req, res) => {
  const result = await classGroupService.listClassGroups(req.query);

  return ApiResponse.success(res, {
    message: 'Class groups fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getClassGroupById = asyncHandler(async (req, res) => {
  const result = await classGroupService.getClassGroupById(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Class group fetched successfully.',
    data: result,
  });
});

const createClassGroup = asyncHandler(async (req, res) => {
  const result = await classGroupService.createClassGroup(req.body);

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Class group created successfully.',
    data: result,
  });
});

const updateClassGroup = asyncHandler(async (req, res) => {
  const result = await classGroupService.updateClassGroup(String(req.params.id), req.body);

  return ApiResponse.success(res, {
    message: 'Class group updated successfully.',
    data: result,
  });
});

const deleteClassGroup = asyncHandler(async (req, res) => {
  const result = await classGroupService.deleteClassGroup(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Class group deleted successfully.',
    data: result,
  });
});

export const classGroupController = {
  listClassGroups,
  getClassGroupById,
  createClassGroup,
  updateClassGroup,
  deleteClassGroup,
};
