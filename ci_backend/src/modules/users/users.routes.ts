import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticateJWT } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { updateUserSchema } from './users.validator';

const router = Router();
const controller = new UsersController();

router.get('/me', authenticateJWT, controller.getProfile);
router.patch('/me', authenticateJWT, validate(updateUserSchema), controller.updateProfile);

export default router;
