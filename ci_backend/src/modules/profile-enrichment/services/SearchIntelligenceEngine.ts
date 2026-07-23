import logger from '../../../config/logger';
import { env } from '../../../config/env';
import { SearchEngineAdapter, SearchResult } from './SearchEngineAdapter';
import { IdentitySignals } from './IdentityResolver';

export interface KnowledgeGraphEntity {
  name: string;
  description?: string;
  entityType: string[];
  officialWebsite?: string;
  relatedEntities?: string[];
  publicInformation?: string;
}

export class SearchIntelligenceEngine {
  private searchAdapter = new SearchEngineAdapter();

  /**
   * Executes a search query using the configured search provider.
   * Forces Google Programmable Search as the primary provider if configured.
   */
  public async executeSearch(query: string): Promise<SearchResult[]> {
    logger.info(`[SearchIntelligenceEngine] Executing intelligent search for query: "${query}"`);
    return await this.searchAdapter.search(query);
  }

  /**
   * Optionally queries the Google Knowledge Graph Search API for the candidate.
   * Returns enrichment data if the person exists in the Knowledge Graph.
   */
  public async queryKnowledgeGraph(signals: IdentitySignals): Promise<KnowledgeGraphEntity | null> {
    const kgKey = env.GOOGLE_KNOWLEDGE_GRAPH_API_KEY;
    if (!kgKey) {
      logger.info(`[SearchIntelligenceEngine] Knowledge Graph API Key not found. Skipping KG enrichment.`);
      return null;
    }

    if (!signals.name) {
      return null;
    }

    try {
      logger.info(`[SearchIntelligenceEngine] Querying Google Knowledge Graph for: ${signals.name}`);
      const query = encodeURIComponent(signals.name);
      // 'Person' limits the search to individuals
      const url = `https://kgsearch.googleapis.com/v1/entities:search?query=${query}&key=${kgKey}&limit=1&types=Person`;

      const response = await fetch(url);
      if (!response.ok) {
        logger.warn(`[SearchIntelligenceEngine] Knowledge Graph API returned status ${response.status}`);
        return null;
      }

      const data = await response.json() as any;
      if (data.itemListElement && data.itemListElement.length > 0) {
        const item = data.itemListElement[0].result;
        
        // Match check: if company is provided, check if it relates to the entity to avoid generic name collisions
        let isConfidentMatch = true;
        if (signals.company && item.detailedDescription) {
          const desc = item.detailedDescription.articleBody?.toLowerCase() || '';
          const comp = signals.company.toLowerCase().split(' ')[0]; // first word of company
          if (comp.length > 3 && !desc.includes(comp)) {
             // If they have a common name and the KG entity doesn't mention their company, 
             // we might have a false positive. We'll still return it but it's a risk.
             logger.info(`[SearchIntelligenceEngine] KG Match found but company '${comp}' not in description. Still returning as optional enrichment.`);
          }
        }

        const entity: KnowledgeGraphEntity = {
          name: item.name,
          description: item.description,
          entityType: item['@type'] || [],
          officialWebsite: item.url,
          publicInformation: item.detailedDescription?.articleBody,
        };

        logger.info(`[SearchIntelligenceEngine] Knowledge Graph Entity found: ${entity.name} - ${entity.description}`);
        return entity;
      }

      logger.info(`[SearchIntelligenceEngine] No Knowledge Graph Entity found for: ${signals.name}`);
      return null;
    } catch (error: any) {
      logger.warn(`[SearchIntelligenceEngine] Knowledge Graph query failed: ${error.message}`);
      return null;
    }
  }
}
