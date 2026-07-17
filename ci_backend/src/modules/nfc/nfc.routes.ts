import { Router } from 'express';
import { NfcController } from './nfc.controller';
import { authenticateJWT } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { readNfcSchema } from './nfc.validator';

const router = Router();
const controller = new NfcController();

router.post('/read', authenticateJWT, validate(readNfcSchema), controller.read);
router.get('/:id', authenticateJWT, controller.getOne);

export default router;
