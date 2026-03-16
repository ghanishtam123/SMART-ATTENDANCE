import { Router } from 'express';

import { authController } from '../controllers/auth.controller';
import {
  authenticate,
  authenticateOptional,
} from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  loginSchema,
  registerSchema,
} from '../validators/auth.validator';

const router = Router();

router.post(
  '/register',
  authenticateOptional,
  validateRequest({ body: registerSchema }),
  authController.register,
);
router.post(
  '/login',
  validateRequest({ body: loginSchema }),
  authController.login,
);
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
