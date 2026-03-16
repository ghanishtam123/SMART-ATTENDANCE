import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { alertController } from '../controllers/alert.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  markUnknownFaceAlertReviewedSchema,
  unknownFaceAlertIdParamSchema,
  unknownFaceAlertListQuerySchema,
} from '../validators/alert.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/unknown-faces',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: unknownFaceAlertListQuerySchema }),
  alertController.listUnknownFaceAlerts,
);
router.patch(
  '/unknown-faces/:id/reviewed',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({
    params: unknownFaceAlertIdParamSchema,
    body: markUnknownFaceAlertReviewedSchema,
  }),
  alertController.markUnknownFaceAlertReviewed,
);

export default router;
