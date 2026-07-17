import { Router } from 'express';
import { BusinessCardsController } from './business-cards.controller';
import { authenticateJWT } from '../../middlewares/auth';
import { upload } from '../../middlewares/upload';

const router = Router();
const controller = new BusinessCardsController();

/**
 * @openapi
 * tags:
 *   name: Business Cards
 *   description: Upload business cards, trigger OCR parsing, and decode QR vCards.
 */

/**
 * @openapi
 * /api/business-card/upload:
 *   post:
 *     summary: Upload a physical business card image
 *     description: Uploads a JPG/PNG card image. Verifies security hashes and queues background OCR and QR decoding.
 *     tags: [Business Cards]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - cardImage
 *             properties:
 *               cardImage:
 *                 type: string
 *                 format: binary
 *               contactId:
 *                 type: string
 *                 description: Optional contact ID to link
 *     responses:
 *       201:
 *         description: Image uploaded successfully and OCR queued
 */
router.post('/upload', authenticateJWT, upload.single('cardImage'), controller.uploadCard);

/**
 * @openapi
 * /api/business-card/{id}:
 *   get:
 *     summary: Retrieve business card details and OCR status
 *     tags: [Business Cards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Business card details and extraction result
 */
router.get('/:id', authenticateJWT, controller.getOne);

/**
 * @openapi
 * /api/business-card/{id}:
 *   delete:
 *     summary: Remove a business card record
 *     tags: [Business Cards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Business card removed successfully
 */
router.delete('/:id', authenticateJWT, controller.deleteOne);

export default router;
