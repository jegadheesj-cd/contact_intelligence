import { Router } from 'express';
import { QrController } from './qr.controller';
import { authenticateJWT } from '../../middlewares/auth';
import { upload } from '../../middlewares/upload';

const router = Router();
const controller = new QrController();

/**
 * @openapi
 * tags:
 *   name: QR Ingestion
 *   description: Extraction and decoding of contact cards from uploaded QR code images.
 */

/**
 * @openapi
 * /api/qr/read:
 *   post:
 *     summary: Parse and decode contact information from an uploaded QR code image
 *     tags: [QR Ingestion]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - qrImage
 *             properties:
 *               qrImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: QR code successfully decoded and contact information structured
 */
router.post('/read', authenticateJWT, upload.single('qrImage'), controller.read);

/**
 * @openapi
 * /api/qr/parse-text:
 *   post:
 *     summary: Parse contact information from a decoded QR code string (live camera)
 *     tags: [QR Ingestion]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - decodedText
 *             properties:
 *               decodedText:
 *                 type: string
 *     responses:
 *       200:
 *         description: QR text successfully parsed
 */
router.post('/parse-text', authenticateJWT, controller.parseText);

export default router;
