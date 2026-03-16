import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  analyticsOverviewQuerySchema,
  lateEntriesQuerySchema,
  lowAttendanceQuerySchema,
  sessionAbsenteesParamSchema,
  sessionAbsenteesQuerySchema,
} from '../validators/analytics.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/attendance-overview',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: analyticsOverviewQuerySchema }),
  analyticsController.getAttendanceOverview,
);
router.get(
  '/low-attendance',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: lowAttendanceQuerySchema }),
  analyticsController.getLowAttendanceStudents,
);
router.get(
  '/late-entries',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: lateEntriesQuerySchema }),
  analyticsController.getLateEntries,
);
router.get(
  '/session-absentees/:sessionId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({
    params: sessionAbsenteesParamSchema,
    query: sessionAbsenteesQuerySchema,
  }),
  analyticsController.getSessionAbsentees,
);

export default router;
