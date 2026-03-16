import { HTTP_STATUS } from '../constants/http';
import { teacherService } from '../services/teacher.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const listTeachers = asyncHandler(async (req, res) => {
  const result = await teacherService.listTeacherProfiles(req.query);

  return ApiResponse.success(res, {
    message: 'Teacher profiles fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getTeacherById = asyncHandler(async (req, res) => {
  const result = await teacherService.getTeacherProfileById(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Teacher profile fetched successfully.',
    data: result,
  });
});

const createTeacher = asyncHandler(async (req, res) => {
  const result = await teacherService.createTeacherProfile(req.body);

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Teacher profile created successfully.',
    data: result,
  });
});

const updateTeacher = asyncHandler(async (req, res) => {
  const result = await teacherService.updateTeacherProfile(String(req.params.id), req.body);

  return ApiResponse.success(res, {
    message: 'Teacher profile updated successfully.',
    data: result,
  });
});

const deleteTeacher = asyncHandler(async (req, res) => {
  const result = await teacherService.deleteTeacherProfile(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Teacher profile deleted successfully.',
    data: result,
  });
});

export const teacherController = {
  listTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
};
