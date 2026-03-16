import { HTTP_STATUS } from '../constants/http';
import { classroomService } from '../services/classroom.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const listClassrooms = asyncHandler(async (req, res) => {
  const result = await classroomService.listClassrooms(req.query);

  return ApiResponse.success(res, {
    message: 'Classrooms fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getClassroomById = asyncHandler(async (req, res) => {
  const result = await classroomService.getClassroomById(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Classroom fetched successfully.',
    data: result,
  });
});

const createClassroom = asyncHandler(async (req, res) => {
  const result = await classroomService.createClassroom(req.body);

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Classroom created successfully.',
    data: result,
  });
});

const updateClassroom = asyncHandler(async (req, res) => {
  const result = await classroomService.updateClassroom(String(req.params.id), req.body);

  return ApiResponse.success(res, {
    message: 'Classroom updated successfully.',
    data: result,
  });
});

const deleteClassroom = asyncHandler(async (req, res) => {
  const result = await classroomService.deleteClassroom(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Classroom deleted successfully.',
    data: result,
  });
});

export const classroomController = {
  listClassrooms,
  getClassroomById,
  createClassroom,
  updateClassroom,
  deleteClassroom,
};
