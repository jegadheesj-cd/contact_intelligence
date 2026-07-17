import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticateJWT } from '../../middlewares/auth';

const router = Router();
const controller = new DashboardController();

/**
 * @openapi
 * tags:
 *   name: Dashboard
 *   description: Statistics, widget aggregations, and queue analytics metrics.
 */

/**
 * @openapi
 * /api/dashboard/widgets:
 *   get:
 *     summary: Retrieve dashboard widget stats
 *     description: Returns contact count, recent uploads, ocr status statistics, and common companies/skills/industries.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard widgets retrieved successfully
 */
router.get('/widgets', authenticateJWT, controller.getWidgets);

/**
 * @openapi
 * /api/dashboard/analytics:
 *   get:
 *     summary: Retrieve platform performance analytics metrics
 *     description: Returns OCR success rate, average processing speed, recognition accuracy score, and BullMQ queue sizes.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform analytics metrics retrieved successfully
 */
router.get('/analytics', authenticateJWT, controller.getAnalytics);

export default router;
