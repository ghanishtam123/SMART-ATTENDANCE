import { HTTP_STATUS } from '../constants/http';
import { buildAuditContext } from '../services/audit.service';
import { userService } from '../services/user.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const listUsers = asyncHandler(async (req, res) => {
  const result = await userService.listUsers(req.query, req.user!);

  return ApiResponse.success(res, {
    message: 'Users fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const result = await userService.getUserById(String(req.params.id), req.user!);

  return ApiResponse.success(res, {
    message: 'User fetched successfully.',
    data: result,
  });
});

const createUser = asyncHandler(async (req, res) => {
  const result = await userService.createUser(
    req.body,
    req.user!,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'User created successfully.',
    data: result,
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const result = await userService.updateUser(
    String(req.params.id),
    req.body,
    req.user!,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    message: 'User updated successfully.',
    data: result,
  });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const result = await userService.updateUserStatus(
    String(req.params.id),
    req.body,
    req.user!,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    message: 'User status updated successfully.',
    data: result,
  });
});

export const userController = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
};
