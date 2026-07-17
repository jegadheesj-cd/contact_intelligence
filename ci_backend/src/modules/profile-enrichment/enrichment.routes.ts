import { Router } from 'express';
import { ProfileEnrichmentController } from './enrichment.controller';
import { authenticateJWT } from '../../middlewares/auth';

const router = Router();
const controller = new ProfileEnrichmentController();

/**
 * @openapi
 * tags:
 *   name: Profile Enrichment
 *   description: Deep professional profile enrichment using LinkedIn and Gemini Grounding.
 */

/**
 * @openapi
 * /api/profile-enrichment/trigger:
 *   post:
 *     summary: Trigger professional profile enrichment pipeline
 *     tags: [Profile Enrichment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contactId
 *             properties:
 *               contactId:
 *                 type: string
 *                 format: uuid
 *                 example: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
 *     responses:
 *       202:
 *         description: Enrichment pipeline queued
 */
router.post('/trigger', authenticateJWT, controller.trigger);

/**
 * @openapi
 * /api/profile-enrichment/instant:
 *   post:
 *     summary: Instantly search and enrich a person online (synchronous API)
 *     tags: [Profile Enrichment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 example: jane.doe@company.com
 *               company:
 *                 type: string
 *                 example: Google
 *     responses:
 *       200:
 *         description: Professional profile details returned instantly
 */
router.post('/instant', authenticateJWT, controller.instant);

export default router;
