import { IReverseFaceSearchProvider, ReverseFaceSearchResponse } from './IReverseFaceSearchProvider';
import { PimEyesProvider } from './PimEyesProvider';
import { AzureAIVisionProvider } from './AzureAIVisionProvider';
import { GoogleReverseImageProvider } from './GoogleReverseImageProvider';
import { AppError } from '../../../utils/AppError';
import logger from '../../../config/logger';
import redisClient from '../../../config/redis';
import crypto from 'crypto';
import fs from 'fs';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);

export class FaceSearchProviderManager {
  private providers: IReverseFaceSearchProvider[] = [];

  constructor() {
    const primary = process.env.FACE_SEARCH_PRIMARY_PROVIDER || 'azure';
    const secondary = process.env.FACE_SEARCH_SECONDARY_PROVIDER || 'pimeyes';

    const providerMap: Record<string, IReverseFaceSearchProvider> = {
      'azure': new AzureAIVisionProvider(),
      'pimeyes': new PimEyesProvider(),
      'google': new GoogleReverseImageProvider(),
      'serpapi': new GoogleReverseImageProvider(),
    };

    if (providerMap[primary]) this.providers.push(providerMap[primary]);
    if (providerMap[secondary] && primary !== secondary) this.providers.push(providerMap[secondary]);

    if (this.providers.length === 0) {
      logger.warn('[FaceSearchProviderManager] No valid face search providers configured.');
    }
  }

  /**
   * Helper for Timeout with Promise.race
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, providerName: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout exceeded for provider ${providerName} after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]);
  }

  /**
   * Check Circuit Breaker state
   */
  private async isCircuitOpen(providerName: string): Promise<boolean> {
    const key = `circuit_breaker:${providerName}`;
    const failures = await redisClient.get(key);
    return failures ? parseInt(failures, 10) >= 3 : false;
  }

  /**
   * Record provider failure for Circuit Breaker
   */
  private async recordFailure(providerName: string): Promise<void> {
    const key = `circuit_breaker:${providerName}`;
    await redisClient.incr(key);
    await redisClient.expire(key, 300); // Reset failure count after 5 minutes
  }

  public async search(imagePath: string): Promise<ReverseFaceSearchResponse> {
    if (this.providers.length === 0) {
      throw new AppError('No reverse face search providers configured.', 500);
    }

    // 1. Hash the actual file content, not the path, for caching
    let fileHash = '';
    try {
      const fileBuffer = await readFileAsync(imagePath);
      fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    } catch (err) {
      logger.error(`[FaceSearchProviderManager] Failed to read image for hashing: ${err}`);
      throw new AppError('Failed to process image file.', 500);
    }

    const cacheKey = `face_osint_search:${fileHash}`;

    // 2. Check Cache
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached && process.env.NODE_ENV !== 'development') {
        logger.info(`[FaceSearchProviderManager] Cache hit for image content hash: ${fileHash}`);
        return JSON.parse(cached);
      } else if (cached && process.env.NODE_ENV === 'development') {
        logger.info(`[FaceSearchProviderManager] Development mode: Bypassing cached face search response to query provider live.`);
      }
    } catch (err) {
      logger.warn(`[FaceSearchProviderManager] Redis cache read failed: ${err}`);
    }

    let lastError = null;

    // 3. Try Providers with Failover, Retry, Circuit Breaker
    for (const provider of this.providers) {
      const isOpen = await this.isCircuitOpen(provider.name);
      if (isOpen) {
        logger.warn(`[FaceSearchProviderManager] Circuit breaker OPEN for ${provider.name}. Skipping.`);
        continue;
      }

      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        attempt++;
        try {
          logger.info(`[FaceSearchProviderManager] Attempt ${attempt} search with provider: ${provider.name}`);
          
          // Timeout set to 15 seconds per provider call
          const response = await this.withTimeout(provider.search(imagePath), 15000, provider.name);

          if (response.success && response.candidates.length > 0) {
            logger.info(`[FaceSearchProviderManager] Success with ${provider.name}. Found ${response.candidates.length} candidates.`);
            
            try {
              await redisClient.setex(cacheKey, 86400, JSON.stringify(response)); // Cache for 24hdays TTL
            } catch (err) {
              logger.warn(`[FaceSearchProviderManager] Redis cache set failed: ${err}`);
            }
            
            return response;
          }

          if (response.success && response.candidates.length === 0) {
            logger.info(`[FaceSearchProviderManager] ${provider.name} returned 0 candidates. Trying next if available.`);
            break; // Valid empty response, don't retry, move to next provider if any
          }
        } catch (error: any) {
          logger.error(`[FaceSearchProviderManager] Provider ${provider.name} attempt ${attempt} failed: ${error.message}`);
          lastError = error;
          
          if (attempt === maxAttempts) {
             await this.recordFailure(provider.name);
          } else {
             // Exponential Backoff (1s, 2s)
             await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }
      }
    }

    if (lastError) {
      logger.error(`[FaceSearchProviderManager] All providers failed. Last error: ${lastError.message}`);
      throw new AppError(`Face OSINT search failed: ${lastError.message}`, 500);
    }

    return {
      success: true,
      provider: 'None',
      candidates: [],
      message: 'No verified public profile found.',
    };
  }
}
