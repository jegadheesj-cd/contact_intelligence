import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  PORT: z.preprocess((val) => Number(val), z.number().default(3000)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.preprocess((val) => Number(val), z.number().default(6379)),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  RATE_LIMIT_WINDOW_MS: z.preprocess((val) => Number(val), z.number().default(900000)),
  RATE_LIMIT_MAX: z.preprocess((val) => Number(val), z.number().default(100)),
  UPLOAD_DIR: z.string().default('./uploads'),
  RAPIDAPI_KEY: z.string().optional(),
  RAPIDAPI_HOST: z.string().default('fresh-linkedin-profile-data.p.rapidapi.com'),
  LINKEDIN_PROVIDER: z.enum(['rapidapi', 'gemini']).default('rapidapi'),
  LINKEDIN_CACHE_TTL: z.preprocess((val) => Number(val || 86400), z.number().default(86400)),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(JSON.stringify(parseResult.error.format(), null, 2));
  process.exit(1);
}

export const env = parseResult.data;
