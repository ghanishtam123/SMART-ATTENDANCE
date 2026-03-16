import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { studentController } from '../controllers/student.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createStudentSchema,
  studentIdParamSchema,
  studentListQuerySchema,
  updateStudentSchema,
} from '../validators/student.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: studentListQuerySchema }),
  studentController.listStudents,
);
router.get(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: studentIdParamSchema }),
  studentController.getStudentById,
);
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ body: createStudentSchema }),
  studentController.createStudent,
);
router.patch(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({
    params: studentIdParamSchema,
    body: updateStudentSchema,
  }),
  studentController.updateStudent,
);
router.delete(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ params: studentIdParamSchema }),
  studentController.deleteStudent,
);

export default router;
