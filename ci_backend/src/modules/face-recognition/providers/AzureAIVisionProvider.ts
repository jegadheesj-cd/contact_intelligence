import { IReverseFaceSearchProvider, ReverseFaceSearchResponse } from './IReverseFaceSearchProvider';
import { AppError } from '../../../utils/AppError';
import logger from '../../../config/logger';

export class AzureAIVisionProvider implements IReverseFaceSearchProvider {
  public readonly name = 'AzureAIVision';

  public async search(imagePath: string): Promise<ReverseFaceSearchResponse> {
    try {
      logger.info(`[AzureAIVisionProvider] Simulating OSINT API call for image: ${imagePath}`);
      
      // Simulate API network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return {
        success: true,
        provider: this.name,
        candidates: [
          {
            title: 'John Doe - Software Architect at OpsNow',
            url: 'https://linkedin.com/in/johndoe-mock',
            confidence: 0.85,
            source: 'LinkedIn via Azure OSINT',
            metadata: {
              location: 'San Francisco, CA'
            }
          }
        ],
        message: 'Search completed successfully, mock match found.',
      };
    } catch (error: any) {
      throw new AppError(`Azure Vision Provider Error: ${error.message}`, 500);
    }
  }
}
