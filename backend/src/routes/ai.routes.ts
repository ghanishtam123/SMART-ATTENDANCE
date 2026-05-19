import { Router } from 'express';

import { aiController } from '../controllers/ai.controller';
import { authenticateAiService } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  aiActiveSessionQuerySchema,
  recognitionBatchSchema,
} from '../validators/ai.validator';

const router = Router();

router.get(
  '/active-session',
  authenticateAiService,
  validateRequest({ query: aiActiveSessionQuerySchema }),
  aiController.getActiveSessionForAi,
);

router.post(
  '/recognition-events',
  authenticateAiService,
  validateRequest({ body: recognitionBatchSchema }),
  aiController.ingestRecognitionEvents,
);

export default router;
