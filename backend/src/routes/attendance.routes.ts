import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { attendanceController } from '../controllers/attendance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  classGroupAttendanceParamSchema,
  classGroupAttendanceSummaryQuerySchema,
  sessionAttendanceParamSchema,
  sessionAttendanceRecordsQuerySchema,
  studentAttendanceHistoryQuerySchema,
  studentAttendanceParamSchema,
} from '../validators/attendance.validator';

const router = Router();

router.use(authenticate);

router.post(
  '/sessions/:sessionId/recalculate',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: sessionAttendanceParamSchema }),
  attendanceController.recalculateSessionAttendance,
);
router.post(
  '/sessions/:sessionId/finalize',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: sessionAttendanceParamSchema }),
  attendanceController.finalizeSessionAttendance,
);
router.get(
  '/sessions/:sessionId/records',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({
    params: sessionAttendanceParamSchema,
    query: sessionAttendanceRecordsQuerySchema,
  }),
  attendanceController.getSessionAttendanceRecords,
);
router.get(
  '/sessions/:sessionId/summary',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: sessionAttendanceParamSchema }),
  attendanceController.getSessionAttendanceSummary,
);
router.get(
  '/class-groups/:classGroupId/summary',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({
    params: classGroupAttendanceParamSchema,
    query: classGroupAttendanceSummaryQuerySchema,
  }),
  attendanceController.getClassGroupAttendanceSummary,
);
router.get(
  '/students/:studentId/history',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({
    params: studentAttendanceParamSchema,
    query: studentAttendanceHistoryQuerySchema,
  }),
  attendanceController.getStudentAttendanceHistory,
);

export default router;
