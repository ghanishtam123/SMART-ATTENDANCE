import { HTTP_STATUS } from '../constants/http';
import { buildAuditContext } from '../services/audit.service';
import { studentService } from '../services/student.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const listStudents = asyncHandler(async (req, res) => {
  const result = await studentService.listStudents(req.query);

  return ApiResponse.success(res, {
    message: 'Students fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getStudentById = asyncHandler(async (req, res) => {
  const result = await studentService.getStudentById(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Student fetched successfully.',
    data: result,
  });
});

const createStudent = asyncHandler(async (req, res) => {
  const result = await studentService.createStudent(
    req.body,
    req.user!,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Student created successfully.',
    data: result,
  });
});

const updateStudent = asyncHandler(async (req, res) => {
  const result = await studentService.updateStudent(
    String(req.params.id),
    req.body,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    message: 'Student updated successfully.',
    data: result,
  });
});

const deleteStudent = asyncHandler(async (req, res) => {
  const result = await studentService.deleteStudent(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Student deleted successfully.',
    data: result,
  });
});

const uploadStudentFaceImages = asyncHandler(async (req, res) => {
  const result = await studentService.saveStudentFaceImages(
    String(req.params.id),
    req.body,
    buildAuditContext(req),
  );

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Student face images saved successfully.',
    data: result,
  });
});

const getStudentFaceImages = asyncHandler(async (req, res) => {
  const result = await studentService.getStudentFaceImages(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Student face images fetched successfully.',
    data: result,
  });
});

export const studentController = {
  listStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  uploadStudentFaceImages,
  getStudentFaceImages,
};
