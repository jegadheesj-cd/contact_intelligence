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

    // Immediately throw error for failures (QUOTA_EXCEEDED, RATE_LIMITED, etc.)
    throw new ProviderError(
      response.status,
      response.provider,
      response.message || 'Provider failed without a specific message.'
    );
  }
}
