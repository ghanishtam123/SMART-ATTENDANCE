import { HTTP_STATUS } from '../constants/http';
import { timetableService } from '../services/timetable.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const listTimetableEntries = asyncHandler(async (req, res) => {
  const result = await timetableService.listTimetableEntries(req.query, req.user!);

  return ApiResponse.success(res, {
    message: 'Timetable entries fetched successfully.',
    data: result.items,
    meta: result.meta,
  });
});

const getTimetableEntryById = asyncHandler(async (req, res) => {
  const result = await timetableService.getTimetableEntryById(
    String(req.params.id),
    req.user!,
  );

  return ApiResponse.success(res, {
    message: 'Timetable entry fetched successfully.',
    data: result,
  });
});

const createTimetableEntry = asyncHandler(async (req, res) => {
  const result = await timetableService.createTimetableEntry(req.body);

  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Timetable entry created successfully.',
    data: result,
  });
});

const updateTimetableEntry = asyncHandler(async (req, res) => {
  const result = await timetableService.updateTimetableEntry(
    String(req.params.id),
    req.body,
  );

  return ApiResponse.success(res, {
    message: 'Timetable entry updated successfully.',
    data: result,
  });
});

const deleteTimetableEntry = asyncHandler(async (req, res) => {
  const result = await timetableService.deleteTimetableEntry(String(req.params.id));

  return ApiResponse.success(res, {
    message: 'Timetable entry deleted successfully.',
    data: result,
  });
});

export const timetableController = {
  listTimetableEntries,
  getTimetableEntryById,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
};
