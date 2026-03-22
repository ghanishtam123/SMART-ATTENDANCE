import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { studentPortalController } from '../controllers/studentPortal.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  studentPortalAttendanceHistoryQuerySchema,
  studentPortalAttendanceExportQuerySchema,
  studentPortalOverviewQuerySchema,
  studentPortalSessionHistoryQuerySchema,
  studentPortalSubjectsQuerySchema,
} from '../validators/studentPortal.validator';

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.STUDENT));

router.get('/me', studentPortalController.getMe);
router.get(
  '/attendance-overview',
  validateRequest({ query: studentPortalOverviewQuerySchema }),
  studentPortalController.getAttendanceOverview,
);
router.get(
  '/attendance-history',
  validateRequest({ query: studentPortalAttendanceHistoryQuerySchema }),
  studentPortalController.getAttendanceHistory,
);
router.get(
  '/attendance-history/export',
  validateRequest({ query: studentPortalAttendanceExportQuerySchema }),
  studentPortalController.exportAttendanceHistory,
);
router.get(
  '/subjects',
  validateRequest({ query: studentPortalSubjectsQuerySchema }),
  studentPortalController.getSubjects,
);
router.get(
  '/session-history',
  validateRequest({ query: studentPortalSessionHistoryQuerySchema }),
  studentPortalController.getSessionHistory,
);

export default router;
