import logger from '../../../config/logger';
import { env } from '../../../config/env';
import * as cheerio from 'cheerio';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export class SearchEngineAdapter {
  public lastProviderUsed: string = 'DuckDuckGo Scraper';

  /**
   * Performs query search using configured search provider, falling back to next options or scraper.
   */
  public async search(query: string): Promise<SearchResult[]> {
    const provider = env.SEARCH_PROVIDER;
    logger.info(`[SearchEngineAdapter] Performing search using provider: ${provider} for query: "${query}"`);

    // Preferred Order: Brave -> Google Custom -> Bing -> Fallback Scraper
    if (provider === 'brave' || (!env.SEARCH_PROVIDER && env.BRAVE_SEARCH_API_KEY)) {
      if (env.BRAVE_SEARCH_API_KEY) {
        try {
          return await this.searchBrave(query);
        } catch (e: any) {
          logger.warn(`[SearchEngineAdapter] Brave search failed, falling back. Error: ${e.message}`);
        }
      } else {
        logger.warn('[SearchEngineAdapter] Brave Search selected but BRAVE_SEARCH_API_KEY is not defined.');
      }
    }

    if (provider === 'google_custom' || (!env.SEARCH_PROVIDER && env.GOOGLE_SEARCH_CX && env.GOOGLE_SEARCH_API_KEY)) {
      if (env.GOOGLE_SEARCH_CX && env.GOOGLE_SEARCH_API_KEY) {
        try {
          return await this.searchGoogleCustom(query);
        } catch (e: any) {
          logger.warn(`[SearchEngineAdapter] Google Custom Search failed, falling back. Error: ${e.message}`);
        }
      } else {
        logger.warn('[SearchEngineAdapter] Google Custom Search selected but keys are not defined.');
      }
    }

    if (provider === 'bing' || (!env.SEARCH_PROVIDER && env.BING_SEARCH_API_KEY)) {
      if (env.BING_SEARCH_API_KEY) {
        try {
          return await this.searchBing(query);
        } catch (e: any) {
          logger.warn(`[SearchEngineAdapter] Bing Search failed, falling back. Error: ${e.message}`);
        }
      } else {
        logger.warn('[SearchEngineAdapter] Bing Search selected but BING_SEARCH_API_KEY is not defined.');
      }
    }

    if (provider === 'tavily' || (!env.SEARCH_PROVIDER && env.TAVILY_API_KEY)) {
      if (env.TAVILY_API_KEY) {
        try {
          return await this.searchTavily(query);
        } catch (e: any) {
          logger.warn(`[SearchEngineAdapter] Tavily Search failed, falling back. Error: ${e.message}`);
        }
      } else {
        logger.warn('[SearchEngineAdapter] Tavily Search selected but TAVILY_API_KEY is not defined.');
      }
    }

    // Default Fallback
    logger.info(`[SearchEngineAdapter] Using fallback scraper search for query: "${query}"`);
    return await this.searchFallback(query);
  }

  private async searchBrave(query: string): Promise<SearchResult[]> {
    this.lastProviderUsed = 'Brave Search';
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const results: SearchResult[] = [];

    if (data.web?.results) {
      for (const res of data.web.results) {
        results.push({
          title: res.title || '',
          url: res.url || '',
          snippet: res.description || '',
          domain: this.extractDomain(res.url),
        });
      }
    }

    return results;
  }

  private async searchGoogleCustom(query: string): Promise<SearchResult[]> {
    this.lastProviderUsed = 'Google Custom Search';
    const cx = env.GOOGLE_SEARCH_CX || '';
    const key = env.GOOGLE_SEARCH_API_KEY || '';
    const url = `https://customsearch.googleapis.com/customsearch/v1?cx=${encodeURIComponent(cx)}&key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Custom Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const results: SearchResult[] = [];

    if (data.items) {
      for (const item of data.items) {
        results.push({
          title: item.title || '',
          url: item.link || '',
          snippet: item.snippet || '',
          domain: this.extractDomain(item.link),
        });
      }
    }

    return results;
  }

  private async searchBing(query: string): Promise<SearchResult[]> {
    this.lastProviderUsed = 'Bing Search';
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': env.BING_SEARCH_API_KEY || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Bing Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const results: SearchResult[] = [];

    if (data.webPages?.value) {
      for (const page of data.webPages.value) {
        results.push({
          title: page.name || '',
          url: page.url || '',
          snippet: page.snippet || '',
          domain: this.extractDomain(page.url),
        });
      }
    }

    return results;
  }

  private async searchFallback(query: string): Promise<SearchResult[]> {
    this.lastProviderUsed = 'DuckDuckGo Scraper';
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        }
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo returned status ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $('.result').each((_, el) => {
        const titleEl = $(el).find('.result__title a');
        const title = titleEl.text().trim();
        const href = titleEl.attr('href');
        const snippet = $(el).find('.result__snippet').text().trim();

        if (title && href) {
          let cleanUrl = href;
          if (href.includes('rut=')) {
            try {
              const parsedUrl = new URL('https://duckduckgo.com' + href);
              const uddg = parsedUrl.searchParams.get('uddg');
              if (uddg) cleanUrl = decodeURIComponent(uddg);
            } catch (e) {}
          }
          results.push({
            title,
            url: cleanUrl,
            snippet,
            domain: this.extractDomain(cleanUrl)
          });
        }
      });

      return results;
    } catch (e: any) {
      logger.error(`[SearchEngineAdapter] Fallback search failed for query: "${query}". Error: ${e.message}`);
      return [];
    }
  }

  private async searchTavily(query: string): Promise<SearchResult[]> {
    this.lastProviderUsed = 'Tavily Search';
    const url = 'https://api.tavily.com/search';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY || '',
        query,
        search_depth: 'basic',
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const results: SearchResult[] = [];

    if (data.results) {
      for (const item of data.results) {
        results.push({
          title: item.title || '',
          url: item.url || '',
          snippet: item.content || '',
          domain: this.extractDomain(item.url),
        });
      }
    }

    return results;
  }

  private extractDomain(urlStr: string): string {
    try {
      const parsed = new URL(urlStr);
      let host = parsed.hostname;
      if (host.startsWith('www.')) host = host.substring(4);
      return host;
    } catch (e) {
      return '';
    }
  }
}
