import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  userIdParamSchema,
  userListQuerySchema,
} from '../validators/user.validator';

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN));

router.get(
  '/',
  validateRequest({ query: userListQuerySchema }),
  userController.listUsers,
);
router.get(
  '/:id',
  validateRequest({ params: userIdParamSchema }),
  userController.getUserById,
);
router.post(
  '/',
  validateRequest({ body: createUserSchema }),
  userController.createUser,
);
router.patch(
  '/:id',
  validateRequest({
    params: userIdParamSchema,
    body: updateUserSchema,
  }),
  userController.updateUser,
);
router.patch(
  '/:id/status',
  validateRequest({
    params: userIdParamSchema,
    body: updateUserStatusSchema,
  }),
  userController.updateUserStatus,
);

export default router;
