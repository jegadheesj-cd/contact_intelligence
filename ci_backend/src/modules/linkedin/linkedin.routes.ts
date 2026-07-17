import { Router } from 'express';
import { LinkedInController } from './linkedin.controller';
import { authenticateJWT } from '../../middlewares/auth';

const router = Router();
const controller = new LinkedInController();

router.post('/search', authenticateJWT, controller.search);
router.get('/profile/:id', authenticateJWT, controller.getProfile);

export default router;
