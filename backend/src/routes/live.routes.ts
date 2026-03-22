import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { liveController } from '../controllers/live.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  activeSessionsQuerySchema,
  liveSessionIdParamSchema,
  recentAlertsQuerySchema,
  recentEventsQuerySchema,
} from '../validators/live.validator';

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER));

router.get(
  '/active-sessions',
  validateRequest({ query: activeSessionsQuerySchema }),
  liveController.getActiveSessions,
);
router.get(
  '/sessions/:sessionId/overview',
  validateRequest({ params: liveSessionIdParamSchema }),
  liveController.getSessionOverview,
);
router.get(
  '/sessions/:sessionId/recent-events',
  validateRequest({
    params: liveSessionIdParamSchema,
    query: recentEventsQuerySchema,
  }),
  liveController.getRecentSessionEvents,
);
router.get(
  '/sessions/:sessionId/recent-alerts',
  validateRequest({
    params: liveSessionIdParamSchema,
    query: recentAlertsQuerySchema,
  }),
  liveController.getRecentSessionAlerts,
);

export default router;
