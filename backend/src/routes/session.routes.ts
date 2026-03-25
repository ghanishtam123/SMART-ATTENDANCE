import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { sessionController } from '../controllers/session.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createSessionSchema,
  createSessionFromTimetableSchema,
  sessionIdParamSchema,
  sessionListQuerySchema,
  updateSessionSchema,
} from '../validators/session.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: sessionListQuerySchema }),
  sessionController.listSessions,
);
router.get(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: sessionIdParamSchema }),
  sessionController.getSessionById,
);
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ body: createSessionSchema }),
  sessionController.createSession,
);
router.post(
  '/from-timetable',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ body: createSessionFromTimetableSchema }),
  sessionController.createSessionFromTimetable,
);
router.patch(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({
    params: sessionIdParamSchema,
    body: updateSessionSchema,
  }),
  sessionController.updateSession,
);
router.delete(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ params: sessionIdParamSchema }),
  sessionController.deleteSession,
);
router.post(
  '/:id/start',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: sessionIdParamSchema }),
  sessionController.startSession,
);
router.post(
  '/:id/complete',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: sessionIdParamSchema }),
  sessionController.completeSession,
);
router.post(
  '/:id/archive',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ params: sessionIdParamSchema }),
  sessionController.archiveSession,
);

export default router;
