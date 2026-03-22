import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { faceProfileController } from '../controllers/faceProfile.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createFaceProfileSchema,
  faceProfileIdParamSchema,
  faceProfileOverviewQuerySchema,
  faceProfileStudentParamSchema,
  updateFaceProfileSchema,
  updateFaceProfileStatusSchema,
} from '../validators/faceProfile.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/overview',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: faceProfileOverviewQuerySchema }),
  faceProfileController.getFaceProfileOverview,
);
router.get(
  '/student/:studentId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: faceProfileStudentParamSchema }),
  faceProfileController.getFaceProfileByStudent,
);
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ body: createFaceProfileSchema }),
  faceProfileController.createFaceProfile,
);
router.patch(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({
    params: faceProfileIdParamSchema,
    body: updateFaceProfileSchema,
  }),
  faceProfileController.updateFaceProfile,
);
router.patch(
  '/:id/status',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({
    params: faceProfileIdParamSchema,
    body: updateFaceProfileStatusSchema,
  }),
  faceProfileController.updateFaceProfileStatus,
);

export default router;
