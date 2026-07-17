import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { env } from './config/env';
import { requestLogger } from './middlewares/logging';
import { rateLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/error';

// Import modular routing definitions
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import contactRoutes from './modules/contacts/contacts.routes';
import businessCardRoutes from './modules/business-cards/business-cards.routes';
import nfcRoutes from './modules/nfc/nfc.routes';
import faceRoutes from './modules/face-recognition/face.routes';
import linkedinRoutes from './modules/linkedin/linkedin.routes';
import enrichmentRoutes from './modules/profile-enrichment/enrichment.routes';
import aiSummaryRoutes from './modules/ai-summary/ai-summary.routes';
import qrRoutes from './modules/qr/qr.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

const app = express();

// Apply response compression
app.use(compression());

// Apply security headers and CORS
app.use(helmet({
  crossOriginResourcePolicy: false, // Allows mobile and web clients to download card/profile images
}));
app.use(cors());

// Parse incoming request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log HTTP transactions and limit requests
app.use(requestLogger);
app.use(rateLimiter);

// Expose public folder for file uploads
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

// Set up Swagger API Documentation UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Base Health Check endpoint
/**
 * @openapi
 * /status:
 *   get:
 *     summary: Get API server health status
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Server is online
 */
app.get('/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Enterprise Contact Intelligence Platform API is online',
    data: {
      uptime: process.uptime(),
      timestamp: new Date(),
      env: env.NODE_ENV,
    },
  });
});

// Register Module Router Handlers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/business-card', businessCardRoutes);
app.use('/api/nfc', nfcRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/linkedin', linkedinRoutes);
app.use('/api/profile-enrichment', enrichmentRoutes);
app.use('/api/ai-summary', aiSummaryRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Fallback Route (404 Resource Not Found)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API Route Not Found: ${req.method} ${req.originalUrl}`,
    error: {},
  });
});

// Centralized error interceptor
app.use(errorHandler);

export default app;
