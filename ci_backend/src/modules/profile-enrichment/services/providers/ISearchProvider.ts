export enum ProviderStatus {
  SUCCESS = 'SUCCESS',
  NO_RESULTS = 'NO_RESULTS',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RATE_LIMITED = 'RATE_LIMITED',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain?: string;
}

export interface SearchResponse {
  success: boolean;
  status: ProviderStatus;
  provider: string;
  results: SearchResult[];
  message?: string;
}

export interface ISearchProvider {
  /**
   * The name of the provider (e.g., 'Tavily', 'Yahoo')
   */
  readonly name: string;

  /**
   * Executes a search query using the provider.
   * @param query The search query string
   * @returns A structured SearchResponse detailing the status and results.
   */
  search(query: string): Promise<SearchResponse>;
}

export class ProviderError extends Error {
  constructor(public status: ProviderStatus, public provider: string, message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}
