import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { classroomController } from '../controllers/classroom.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  classroomIdParamSchema,
  classroomListQuerySchema,
  createClassroomSchema,
  updateClassroomSchema,
} from '../validators/classroom.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: classroomListQuerySchema }),
  classroomController.listClassrooms,
);
router.get(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: classroomIdParamSchema }),
  classroomController.getClassroomById,
);
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ body: createClassroomSchema }),
  classroomController.createClassroom,
);
router.patch(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({
    params: classroomIdParamSchema,
    body: updateClassroomSchema,
  }),
  classroomController.updateClassroom,
);
router.delete(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ params: classroomIdParamSchema }),
  classroomController.deleteClassroom,
);

export default router;
