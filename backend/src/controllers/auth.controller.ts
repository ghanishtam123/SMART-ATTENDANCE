import { HTTP_STATUS } from '../constants/http';
import { authService } from '../services/auth.service';
import { buildAuditContext } from '../services/audit.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, {
    currentUser: req.user,
    bootstrapSecret:
      typeof req.headers['x-bootstrap-secret'] === 'string'
        ? req.headers['x-bootstrap-secret']
        : undefined,
    auditContext: buildAuditContext(req),
  });

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'User registered successfully.',
    data: result,
  });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, buildAuditContext(req));

  return ApiResponse.success(res, {
    message: 'Login successful.',
    data: result,
  });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const result = await authService.getCurrentUser(req.user!);

  return ApiResponse.success(res, {
    message: 'Authenticated user fetched successfully.',
    data: result,
  });
});

export const authController = {
  register,
  login,
  getCurrentUser,
};
