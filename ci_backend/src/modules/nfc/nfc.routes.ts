import { Router } from 'express';
import { NfcController } from './nfc.controller';
import { authenticateJWT } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { readNfcSchema } from './nfc.validator';

const router = Router();
const controller = new NfcController();

/**
 * @openapi
 * tags:
 *   name: NFC
 *   description: NFC data payload record transfers and extraction.
 */

/**
 * @openapi
 * /api/nfc/read:
 *   post:
 *     summary: Record and normalize NFC contact details
 *     tags: [NFC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payload
 *             properties:
 *               contactId:
 *                 type: string
 *                 format: uuid
 *                 example: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
 *               payload:
 *                 type: object
 *                 example: { "fullName": "Jane Doe", "phoneNumber": "+1-555-0000" }
 *     responses:
 *       201:
 *         description: NFC payload processed and recorded successfully
 */
router.post('/read', authenticateJWT, validate(readNfcSchema), controller.read);

/**
 * @openapi
 * /api/nfc/{id}:
 *   get:
 *     summary: Retrieve recorded NFC payload by ID
 *     tags: [NFC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: NFC record data retrieved successfully
 *       404:
 *         description: Record not found
 */
router.get('/:id', authenticateJWT, controller.getOne);

export default router;
