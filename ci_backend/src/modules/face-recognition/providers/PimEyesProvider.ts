import { IReverseFaceSearchProvider, ReverseFaceSearchResponse } from './IReverseFaceSearchProvider';
import { AppError } from '../../../utils/AppError';
import logger from '../../../config/logger';

export class PimEyesProvider implements IReverseFaceSearchProvider {
  public readonly name = 'PimEyes';

  public async search(imagePath: string): Promise<ReverseFaceSearchResponse> {
    const apiKey = process.env.PIMEYES_API_KEY;
    
    if (!apiKey) {
      logger.warn('[PimEyesProvider] API key missing.');
      throw new AppError('PimEyes API key not configured.', 500);
    }

    try {
      // Real implementation would upload the image to PimEyes API
      logger.info(`[PimEyesProvider] Simulating API call for image: ${imagePath}`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        provider: this.name,
        candidates: [], // Returns empty list in absence of real API response
        message: 'Search completed successfully, no matches found in simulation.',
      };
    } catch (error: any) {
      throw new AppError(`PimEyes Provider Error: ${error.message}`, 500);
    }
  }
}
