import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middlewares/validate';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.validator';
import { authenticateJWT } from '../../middlewares/auth';

const router = Router();
const controller = new AuthController();

/**
 * @openapi
 * tags:
 *   name: Authentication
 *   description: User registration, login, JWT token refresh, and logout routines.
 */

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user profile
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane.doe@enterprise.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: securePassword123
 *               organization:
 *                 type: string
 *                 description: Optional. Defaults to Individual when omitted.
 *                 example: Acme Corp
 *               role:
 *                 type: string
 *                 enum: [ADMIN, USER]
 *                 example: USER
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request or duplicate email
 */
router.post('/register', validate(registerSchema), controller.register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: User Login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane.doe@enterprise.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: securePassword123
 *     responses:
 *       200:
 *         description: Logged in successfully
 *       401:
 *         description: Invalid login credentials
 */
router.post('/login', validate(loginSchema), controller.login);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh JWT Access Token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', validate(refreshTokenSchema), controller.refresh);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: User Logout
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', authenticateJWT, controller.logout);

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset link (Mocked)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane.doe@enterprise.com
 *     responses:
 *       200:
 *         description: Request processed (mocked email delivery log)
 */
router.post('/forgot-password', controller.forgotPassword);

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     summary: Execute password reset (Mocked)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane.doe@enterprise.com
 *     responses:
 *       200:
 *         description: Password reset complete
 */
router.post('/reset-password', controller.resetPassword);

export default router;
