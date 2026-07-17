import { Router } from 'express';
import { AiSummaryController } from './ai-summary.controller';
import { authenticateJWT } from '../../middlewares/auth';

const router = Router();
const controller = new AiSummaryController();

router.post('/', authenticateJWT, controller.generate);

export default router;
