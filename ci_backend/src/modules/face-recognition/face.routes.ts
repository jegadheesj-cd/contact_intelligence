import { Router } from 'express';
import { FaceRecognitionController } from './face.controller';
import { authenticateJWT } from '../../middlewares/auth';
import { upload } from '../../middlewares/upload';

const router = Router();
const controller = new FaceRecognitionController();

/**
 * @openapi
 * tags:
 *   name: Face Recognition
 *   description: Biometric face enrollment, verification, and video analysis.
 */

/**
 * @openapi
 * /api/face/upload:
 *   post:
 *     summary: Verify face photo against enrolled contact profiles
 *     tags: [Face Recognition]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - facePhoto
 *             properties:
 *               facePhoto:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Photo uploaded successfully and match analysis queued
 */
router.post('/upload', authenticateJWT, upload.single('facePhoto'), controller.uploadPhoto);

/**
 * @openapi
 * /api/face/video:
 *   post:
 *     summary: Verify face video against enrolled contact profiles
 *     tags: [Face Recognition]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - faceVideo
 *             properties:
 *               faceVideo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Video uploaded successfully and match analysis queued
 */
router.post('/video', authenticateJWT, upload.single('faceVideo'), controller.uploadVideo);

/**
 * @openapi
 * /api/face/profile/{id}:
 *   get:
 *     summary: Get face verification analysis result
 *     tags: [Face Recognition]
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
 *         description: Recognition match details and verification status
 */
router.get('/profile/:id', authenticateJWT, controller.getProfile);

/**
 * @openapi
 * /api/face/enroll:
 *   post:
 *     summary: Enroll a face biometric signature for a contact
 *     tags: [Face Recognition]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - facePhoto
 *               - contactId
 *             properties:
 *               facePhoto:
 *                 type: string
 *                 format: binary
 *               contactId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Biometric signature successfully enrolled
 */
router.post('/enroll', authenticateJWT, upload.single('facePhoto'), controller.enroll);

/**
 * @openapi
 * /api/face/list:
 *   get:
 *     summary: List all enrolled face signatures
 *     tags: [Face Recognition]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of enrolled signatures retrieved successfully
 */
router.get('/list', authenticateJWT, controller.list);

/**
 * @openapi
 * /api/face/{id}:
 *   delete:
 *     summary: Revoke an enrolled face signature
 *     tags: [Face Recognition]
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
 *         description: Biometric signature successfully revoked
 */
router.delete('/:id', authenticateJWT, controller.remove);

export default router;
