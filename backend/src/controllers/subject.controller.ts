import { HTTP_STATUS } from '../constants/http';
import { subjectService } from '../services/subject.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const listSubjects = asyncHandler(async (req, res) => {
  const result = await subjectService.listSubjects(req.query);

  return ApiResponse.success(res, {
    message: 'Subjects fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getSubjectById = asyncHandler(async (req, res) => {
  const result = await subjectService.getSubjectById(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Subject fetched successfully.',
    data: result,
  });
});

const createSubject = asyncHandler(async (req, res) => {
  const result = await subjectService.createSubject(req.body);

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Subject created successfully.',
    data: result,
  });
});

const updateSubject = asyncHandler(async (req, res) => {
  const result = await subjectService.updateSubject(String(req.params.id), req.body);

  return ApiResponse.success(res, {
    message: 'Subject updated successfully.',
    data: result,
  });
});

const deleteSubject = asyncHandler(async (req, res) => {
  const result = await subjectService.deleteSubject(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Subject deleted successfully.',
    data: result,
  });
});

export const subjectController = {
  listSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
};
