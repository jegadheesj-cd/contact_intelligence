import { ILinkedInService } from './linkedin.interface';
import { ILinkedInProvider, PublicInfoLinkedInProvider, RapidApiLinkedInProvider } from './linkedin.provider';
import { env } from '../../config/env';
import logger from '../../config/logger';

export class LinkedInService implements ILinkedInService {
  private provider: ILinkedInProvider;

  constructor(provider?: ILinkedInProvider) {
    if (provider) {
      this.provider = provider;
    } else {
      // Choose provider dynamically based on environment config
      if (env.LINKEDIN_PROVIDER === 'gemini') {
        logger.info('[LinkedIn Service] Initialized with Gemini/PublicInfo Provider');
        this.provider = new PublicInfoLinkedInProvider();
      } else {
        logger.info('[LinkedIn Service] Initialized with RapidAPI Provider');
        this.provider = new RapidApiLinkedInProvider();
      }
    }
  }

  /**
   * Sets or swaps the active LinkedIn integration provider dynamically.
   */
  public setProvider(provider: ILinkedInProvider): void {
    logger.info('[LinkedIn Service] Dynamic provider switch triggered');
    this.provider = provider;
  }

  public async searchProfiles(name: string, company?: string): Promise<any> {
    try {
      return await this.provider.search(name, company);
    } catch (err: any) {
      // Check if we can fallback to Gemini/PublicInfo provider
      if (!(this.provider instanceof PublicInfoLinkedInProvider)) {
        logger.warn(`[LinkedIn Fallback] Primary provider search failed: ${err.message}. Activating PublicInfo/Gemini fallback...`);
        const fallback = new PublicInfoLinkedInProvider();
        return await fallback.search(name, company);
      }
      throw err;
    }
  }

  public async getProfileDetails(profileId: string): Promise<any> {
    try {
      return await this.provider.getDetails(profileId);
    } catch (err: any) {
      if (!(this.provider instanceof PublicInfoLinkedInProvider)) {
        logger.warn(`[LinkedIn Fallback] Primary provider getDetails failed: ${err.message}. Activating PublicInfo/Gemini fallback...`);
        const fallback = new PublicInfoLinkedInProvider();
        return await fallback.getDetails(profileId);
      }
      throw err;
    }
  }
}

export default new LinkedInService();
