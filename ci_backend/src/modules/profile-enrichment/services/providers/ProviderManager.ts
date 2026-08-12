import { ISearchProvider, ProviderStatus, SearchResponse, ProviderError } from './ISearchProvider';
import { TavilyProvider } from './TavilyProvider';

export class ProviderManager {
  private provider: ISearchProvider;

  constructor() {
    this.provider = new TavilyProvider();
  }

  /**
   * Executes a search query using Tavily.
   * Throws ProviderError immediately if the provider fails.
   */
  public async search(query: string): Promise<SearchResponse> {
    console.log(`[ProviderManager] Executing query via ${this.provider.name}: ${query}`);
    const response = await this.provider.search(query);

    if (response.success || response.status === ProviderStatus.NO_RESULTS) {
      return response;
    }

    // Log warning and return empty results for failures (QUOTA_EXCEEDED, RATE_LIMITED, etc.)
    console.warn(`[ProviderManager] Provider ${response.provider} failed: ${response.message}`);
    return {
      success: false,
      provider: response.provider,
      status: response.status,
      results: [],
      message: response.message
    };
  }
}
