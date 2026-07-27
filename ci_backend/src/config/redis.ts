import Redis from 'ioredis';
import { env } from './env';
import logger from './logger';

const redisClient = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

export default redisClient;
