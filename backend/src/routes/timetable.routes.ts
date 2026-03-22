import { Router } from 'express';

import { UserRole } from '../constants/roles';
import { timetableController } from '../controllers/timetable.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createTimetableEntrySchema,
  timetableEntryIdParamSchema,
  timetableListQuerySchema,
  updateTimetableEntrySchema,
} from '../validators/timetable.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ query: timetableListQuerySchema }),
  timetableController.listTimetableEntries,
);
router.get(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER),
  validateRequest({ params: timetableEntryIdParamSchema }),
  timetableController.getTimetableEntryById,
);
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ body: createTimetableEntrySchema }),
  timetableController.createTimetableEntry,
);
router.patch(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({
    params: timetableEntryIdParamSchema,
    body: updateTimetableEntrySchema,
  }),
  timetableController.updateTimetableEntry,
);
router.delete(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateRequest({ params: timetableEntryIdParamSchema }),
  timetableController.deleteTimetableEntry,
);

export default router;
