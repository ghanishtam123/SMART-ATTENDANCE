import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { classGroupController } from '../controllers/classGroup.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  classGroupIdParamSchema,
  classGroupListQuerySchema,
  createClassGroupSchema,
  updateClassGroupSchema,
} from '../validators/classGroup.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: classGroupListQuerySchema }),
  classGroupController.listClassGroups,
);
router.get(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: classGroupIdParamSchema }),
  classGroupController.getClassGroupById,
);
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ body: createClassGroupSchema }),
  classGroupController.createClassGroup,
);
router.patch(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({
    params: classGroupIdParamSchema,
    body: updateClassGroupSchema,
  }),
  classGroupController.updateClassGroup,
);
router.delete(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ params: classGroupIdParamSchema }),
  classGroupController.deleteClassGroup,
);

export default router;
