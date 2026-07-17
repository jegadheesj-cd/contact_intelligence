import { Router } from 'express';
import { ProfileEnrichmentController } from './enrichment.controller';
import { authenticateJWT } from '../../middlewares/auth';

const router = Router();
const controller = new ProfileEnrichmentController();

router.post('/trigger', authenticateJWT, controller.trigger);
router.post('/instant', authenticateJWT, controller.instant);

export default router;
