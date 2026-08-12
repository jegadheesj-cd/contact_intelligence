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

export async function addJobWithTimeout<T = any>(
  queue: Queue,
  name: string,
  data: any,
  opts?: any,
  timeoutMs: number = 2000
): Promise<T> {
  const addPromise = queue.add(name, data, opts);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Redis connection timeout')), timeoutMs)
  );
  return Promise.race([addPromise, timeoutPromise]) as Promise<T>;
}

