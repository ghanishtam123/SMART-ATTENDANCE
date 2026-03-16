import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { teacherController } from '../controllers/teacher.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createTeacherProfileSchema,
  teacherIdParamSchema,
  teacherListQuerySchema,
  updateTeacherProfileSchema,
} from '../validators/teacher.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: teacherListQuerySchema }),
  teacherController.listTeachers,
);
router.get(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: teacherIdParamSchema }),
  teacherController.getTeacherById,
);
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ body: createTeacherProfileSchema }),
  teacherController.createTeacher,
);
router.patch(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({
    params: teacherIdParamSchema,
    body: updateTeacherProfileSchema,
  }),
  teacherController.updateTeacher,
);
router.delete(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ params: teacherIdParamSchema }),
  teacherController.deleteTeacher,
);

export default router;
