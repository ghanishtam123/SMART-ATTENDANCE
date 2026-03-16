import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { subjectController } from '../controllers/subject.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createSubjectSchema,
  subjectIdParamSchema,
  subjectListQuerySchema,
  updateSubjectSchema,
} from '../validators/subject.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: subjectListQuerySchema }),
  subjectController.listSubjects,
);
router.get(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: subjectIdParamSchema }),
  subjectController.getSubjectById,
);
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ body: createSubjectSchema }),
  subjectController.createSubject,
);
router.patch(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({
    params: subjectIdParamSchema,
    body: updateSubjectSchema,
  }),
  subjectController.updateSubject,
);
router.delete(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ params: subjectIdParamSchema }),
  subjectController.deleteSubject,
);

export default router;
