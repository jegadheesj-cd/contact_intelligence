import { ISearchProvider, ProviderStatus, SearchResponse, SearchResult } from './ISearchProvider';
import { env } from '../../../../config/env';

export class TavilyProvider implements ISearchProvider {
  public readonly name = 'Tavily';

  public async search(query: string): Promise<SearchResponse> {
    if (!env.TAVILY_API_KEY) {
      return {
        success: false,
        status: ProviderStatus.AUTHENTICATION_FAILED,
        provider: this.name,
        results: [],
        message: 'Tavily API key is missing or not configured.',
      };
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: env.TAVILY_API_KEY,
          query: query,
          search_depth: 'basic',
          include_answer: false,
          max_results: 5,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, status: ProviderStatus.AUTHENTICATION_FAILED, provider: this.name, results: [], message: 'Tavily API returned 401 Unauthorized.' };
        }
        if (response.status === 429) {
          return { success: false, status: ProviderStatus.RATE_LIMITED, provider: this.name, results: [], message: 'Tavily API returned 429 Rate Limited.' };
        }
        if (response.status === 432) {
          return { success: false, status: ProviderStatus.QUOTA_EXCEEDED, provider: this.name, results: [], message: 'Tavily API credits exhausted (432 Insufficient Balance).' };
        }
        if (response.status >= 500) {
          return { success: false, status: ProviderStatus.PROVIDER_UNAVAILABLE, provider: this.name, results: [], message: `Tavily API returned server error ${response.status}.` };
        }
        return { success: false, status: ProviderStatus.NETWORK_ERROR, provider: this.name, results: [], message: `Tavily API returned status ${response.status}.` };
      }

      const data: any = await response.json();
      
      if (!data.results || data.results.length === 0) {
        return {
          success: true,
          status: ProviderStatus.NO_RESULTS,
          provider: this.name,
          results: [],
        };
      }

      const mappedResults: SearchResult[] = data.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        domain: this.extractDomain(r.url)
      }));

      return {
        success: true,
        status: ProviderStatus.SUCCESS,
        provider: this.name,
        results: mappedResults,
      };

    } catch (error: any) {
      return {
        success: false,
        status: ProviderStatus.NETWORK_ERROR,
        provider: this.name,
        results: [],
        message: `Tavily network error: ${error.message}`,
      };
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  }
}
