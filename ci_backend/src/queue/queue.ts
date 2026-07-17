import { Queue } from 'bullmq';
import { env } from '../config/env';
import logger from '../config/logger';

export const connectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null, // Required by BullMQ
};

export const ocrQueue = new Queue('ocr-queue', { connection: connectionOptions });
export const enrichmentQueue = new Queue('enrichment-queue', { connection: connectionOptions });
export const aiSummaryQueue = new Queue('ai-summary-queue', { connection: connectionOptions });
export const faceRecognitionQueue = new Queue('face-recognition-queue', { connection: connectionOptions });

logger.info('BullMQ Queues initialized with connection options.');

