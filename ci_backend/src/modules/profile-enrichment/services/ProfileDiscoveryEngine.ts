import logger from '../../../config/logger';
import { IdentityResolver, IdentitySignals } from './IdentityResolver';
import { SearchQueryBuilder } from './SearchQueryBuilder';
import { SearchEngineAdapter, SearchResult } from './SearchEngineAdapter';
import { CheerioParser } from './CheerioParser';
import { stringSimilarity } from '../../../utils/stringUtils';

export interface CandidateProfile {
  fullName: string;
  headline?: string;
  company?: string;
  designation?: string;
  location?: string;
  industry?: string;
  profileImage?: string;
  summary?: string;
  experience: Array<{ title: string; company: string; period: string; description?: string }>;
  education: Array<{ school: string; degree: string; year: string; fieldOfStudy?: string }>;
  skills: string[];
  projects: Array<{ name: string; description: string; technologies?: string[]; duration?: string }>;
  certifications?: string[];
  achievements?: string[];
  organizations?: string[];
  volunteerExperience?: string[];
  publications?: string[];
  languages?: string[];
  interests?: string[];
  publicProfiles: Array<{ platform: string; url: string; confidence?: number; reasons?: string[] }>;
  // GitHub-specific
  repositories?: Array<{ name: string; description: string; language: string; stars: number; forks: number; url: string; topics?: string[] }>;
  pinnedRepositories?: Array<{ name: string; description: string; language: string; stars: number; url: string }>;
  primaryLanguages?: string[];
  technologies?: string[];
  githubStats?: { followers: number; following: number; publicRepos: number; login: string };
  // Company website specific
  companyBio?: string;
  companyRole?: string;
  companyDepartment?: string;
  companyPhotoUrl?: string;
  // Metadata
  source: string;
  sourceConfidence: number;
  verificationStatus?: string;
}

export interface DiscoveryResult {
  candidates: CandidateProfile[];
  linkedInUrl: string | null;
  githubUrl: string | null;
  companyWebsiteUrl: string | null;
  searchQueries: string[];
  allDiscoveredUrls: Array<{ url: string; source: string }>;
  rejectionReasons: string[];
  searchProcess: Record<string, string>;
}

export class ProfileDiscoveryEngine {
  private identityResolver = new IdentityResolver();
  private queryBuilder = new SearchQueryBuilder();
  private searchAdapter = new SearchEngineAdapter();
  private cheerioParser = new CheerioParser();

  /**
   * Main discovery method — discovers all candidate profiles from all sources in parallel.
   */
  public async discoverCandidates(contact: any): Promise<CandidateProfile[]> {
    logger.info(`[ProfileDiscoveryEngine] Starting candidates discovery for: ${contact.name}`);
    const result = await this.fullDiscovery(contact);
    return result.candidates;
  }

  /**
   * Full discovery returning detailed metadata for logging/proof.
   */
  public async fullDiscovery(contact: any): Promise<DiscoveryResult> {
    logger.info(`[ProfileDiscoveryEngine] Executing stage: Identity Resolution`);
    const signals = this.identityResolver.resolve(contact);

    const allDiscoveredUrls: Array<{ url: string; source: string }> = [];
    const searchQueries: string[] = [];
    const rejectionReasons: string[] = [];
    const searchProcess: Record<string, string> = {
      "Brave Search": "0 Results",
      "Google Custom Search": "0 Results",
      "Bing Search": "0 Results",
      "DuckDuckGo Scraper": "0 Results",
      "Tavily Search": "0 Results"
    };
    
    const discoveredLinkedInUrls = new Map<string, { title: string; description: string }>();
    const discoveredGitHubUrls = new Set<string>();
    const discoveredCompanyUrls = new Set<string>();
    const discoveredPortfolioUrls = new Set<string>();
    const discoveredInstagramUrls = new Map<string, { title: string; description: string }>();
    const discoveredFacebookUrls = new Map<string, { title: string; description: string }>();
    const discoveredTwitterUrls = new Map<string, { title: string; description: string }>();

    const trackSearchProviderResults = (results: any[]) => {
      const provider = this.searchAdapter.lastProviderUsed;
      const current = searchProcess[provider] || "0 Results";
      let count = 0;
      if (current.includes("Results")) {
        count = parseInt(current.split(" ")[0]) || 0;
      }
      searchProcess[provider] = `${count + results.length} Results`;
    };

    // 1. Check for direct LinkedIn URL on the card
    if (signals.website && signals.website.includes('linkedin.com/in/')) {
      logger.info(`[ProfileDiscoveryEngine] Direct LinkedIn URL found: ${signals.website}`);
      discoveredLinkedInUrls.set(signals.website, { title: signals.name || '', description: `Direct from business card - ${signals.company || ''} ${signals.designation || ''}` });
      allDiscoveredUrls.push({ url: signals.website, source: 'business-card-direct' });
    }

    logger.info(`[ProfileDiscoveryEngine] Executing stage: Search Query Builder`);
    const linkedinQueries = this.queryBuilder.buildLinkedInQueries(signals);
    const githubQueries = this.queryBuilder.buildGitHubQueries(signals);
    const companyQueries = this.queryBuilder.buildCompanyQueries(signals);
    const instagramQueries = this.queryBuilder.buildInstagramQueries(signals);
    const facebookQueries = this.queryBuilder.buildFacebookQueries(signals);
    const twitterQueries = this.queryBuilder.buildTwitterQueries(signals);

    // 2. Discover LinkedIn URLs via queries
    for (const query of linkedinQueries) {
      searchQueries.push(query);
      try {
        logger.info(`[ProfileDiscoveryEngine] Executing search query: "${query}"`);
        const results = await this.searchAdapter.search(query);
        trackSearchProviderResults(results);

        for (const res of results) {
          if (res.url.includes('linkedin.com/in/')) {
            discoveredLinkedInUrls.set(res.url, { title: res.title || '', description: res.snippet || '' });
            allDiscoveredUrls.push({ url: res.url, source: 'linkedin-discovery-search' });
          }
        }
      } catch (e: any) {
        logger.warn(`[ProfileDiscoveryEngine] LinkedIn Search failed for query "${query}": ${e.message}`);
        rejectionReasons.push(`LinkedIn search failed: ${e.message}`);
      }
    }

    // 3. Discover Company Website
    if (signals.website && !signals.website.includes('linkedin.com') && !signals.website.includes('github.com')) {
      discoveredCompanyUrls.add(signals.website);
    }
    for (const query of companyQueries) {
      searchQueries.push(query);
      try {
        logger.info(`[ProfileDiscoveryEngine] Searching for Company Website using query: "${query}"`);
        const results = await this.searchAdapter.search(query);
        trackSearchProviderResults(results);

        for (const res of results) {
          if (res.url && !res.url.includes('linkedin.com') && !res.url.includes('github.com') && !res.url.includes('wikipedia.org')) {
            discoveredCompanyUrls.add(res.url);
            allDiscoveredUrls.push({ url: res.url, source: 'company-website-search' });
          }
        }
      } catch (e: any) {
        logger.warn(`[ProfileDiscoveryEngine] Company Web Search query failed: ${e.message}`);
      }
    }

    // 4. Discover GitHub URLs
    for (const query of githubQueries) {
      searchQueries.push(query);
      try {
        logger.info(`[ProfileDiscoveryEngine] Searching for GitHub URL using query: "${query}"`);
        const results = await this.searchAdapter.search(query);
        trackSearchProviderResults(results);

        for (const res of results) {
          if (res.url.includes('github.com/') && !res.url.includes('/search') && !res.url.includes('/topics')) {
            discoveredGitHubUrls.add(res.url);
            allDiscoveredUrls.push({ url: res.url, source: 'github-url-search' });
          }
        }
      } catch (e: any) {
        logger.warn(`[ProfileDiscoveryEngine] GitHub URL search query failed: ${e.message}`);
      }
    }

    // 5. Discover Portfolios
    if (signals.name) {
      const portQuery = `"${signals.name}" portfolio OR personal website`;
      searchQueries.push(portQuery);
      try {
        logger.info(`[ProfileDiscoveryEngine] Searching for Portfolios using query: "${portQuery}"`);
        const results = await this.searchAdapter.search(portQuery);
        trackSearchProviderResults(results);

        for (const res of results) {
          if (res.url && !res.url.includes('linkedin.com') && !res.url.includes('github.com') && !res.url.includes('wikipedia.org')) {
            discoveredPortfolioUrls.add(res.url);
          }
        }
      } catch (e: any) {
        logger.warn(`[ProfileDiscoveryEngine] Portfolio discovery query failed: ${e.message}`);
      }
    }

    // 6. Discover Instagram URLs
    for (const query of instagramQueries) {
      searchQueries.push(query);
      try {
        logger.info(`[ProfileDiscoveryEngine] Searching for Instagram profiles using query: "${query}"`);
        const results = await this.searchAdapter.search(query);
        trackSearchProviderResults(results);

        for (const res of results) {
          if (res.url.includes('instagram.com/') && !res.url.includes('/explore') && !res.url.includes('/tags') && !res.url.includes('/locations')) {
            discoveredInstagramUrls.set(res.url, { title: res.title || '', description: res.snippet || '' });
            allDiscoveredUrls.push({ url: res.url, source: 'instagram-discovery-search' });
          }
        }
      } catch (e: any) {
        logger.warn(`[ProfileDiscoveryEngine] Instagram Search failed for query "${query}": ${e.message}`);
        rejectionReasons.push(`Instagram search failed: ${e.message}`);
      }
    }

    // 7. Discover Facebook URLs
    for (const query of facebookQueries) {
      searchQueries.push(query);
      try {
        logger.info(`[ProfileDiscoveryEngine] Searching for Facebook profiles using query: "${query}"`);
        const results = await this.searchAdapter.search(query);
        trackSearchProviderResults(results);

        for (const res of results) {
          if (res.url.includes('facebook.com/') && !res.url.includes('/groups') && !res.url.includes('/events') && !res.url.includes('/marketplace')) {
            discoveredFacebookUrls.set(res.url, { title: res.title || '', description: res.snippet || '' });
            allDiscoveredUrls.push({ url: res.url, source: 'facebook-discovery-search' });
          }
        }
      } catch (e: any) {
        logger.warn(`[ProfileDiscoveryEngine] Facebook Search failed for query "${query}": ${e.message}`);
        rejectionReasons.push(`Facebook search failed: ${e.message}`);
      }
    }

    // 8. Discover Twitter/X URLs
    for (const query of twitterQueries) {
      searchQueries.push(query);
      try {
        logger.info(`[ProfileDiscoveryEngine] Searching for Twitter/X profiles using query: "${query}"`);
        const results = await this.searchAdapter.search(query);
        trackSearchProviderResults(results);

        for (const res of results) {
          if ((res.url.includes('twitter.com/') || res.url.includes('x.com/')) && !res.url.includes('/search') && !res.url.includes('/hashtag') && !res.url.includes('/i/')) {
            discoveredTwitterUrls.set(res.url, { title: res.title || '', description: res.snippet || '' });
            allDiscoveredUrls.push({ url: res.url, source: 'twitter-discovery-search' });
          }
        }
      } catch (e: any) {
        logger.warn(`[ProfileDiscoveryEngine] Twitter/X Search failed for query "${query}": ${e.message}`);
        rejectionReasons.push(`Twitter/X search failed: ${e.message}`);
      }
    }

    // ─── Parallel Ingestions / BeautifulSoup Parsers ──────────────────────────
    logger.info(`[ProfileDiscoveryEngine] Executing stage: Evidence Collection & BeautifulSoup Parsing`);

    // Fetch GitHub Details for up to 3 candidates
    const githubUrlsList = Array.from(discoveredGitHubUrls).slice(0, 3);
    const githubPromises = githubUrlsList.map(url =>
      this.fetchGitHubDetails(url).catch(e => {
        logger.error(`[ProfileDiscoveryEngine] GitHub Collector failure for ${url}: ${e.message}`);
        rejectionReasons.push(`GitHub Collector URL "${url}" error: ${e.message}`);
        return null;
      })
    );

    // Scrape Company Websites for up to 2 candidates
    const companyUrlsList = Array.from(discoveredCompanyUrls).slice(0, 2);
    const companyWebPromises = companyUrlsList.map(url =>
      this.scrapeCompanyWebsite(url, signals.name).catch(e => {
        logger.error(`[ProfileDiscoveryEngine] Cheerio Web Scraper failure for ${url}: ${e.message}`);
        rejectionReasons.push(`Company Web Parser URL "${url}" error: ${e.message}`);
        return null;
      })
    );

    // Scrape Portfolios for up to 2 candidates
    const portfolioUrlsList = Array.from(discoveredPortfolioUrls).slice(0, 2);
    const portfolioPromises = portfolioUrlsList.map(url =>
      this.scrapePortfolio(url).catch(e => {
        logger.error(`[ProfileDiscoveryEngine] Portfolio Parser failure for ${url}: ${e.message}`);
        rejectionReasons.push(`Portfolio Scraper URL "${url}" error: ${e.message}`);
        return null;
      })
    );

    // Attempt to scrape public social profiles for up to 3 candidates each
    const instagramUrlsList = Array.from(discoveredInstagramUrls.entries()).slice(0, 3);
    const instagramPromises = instagramUrlsList.map(([url]) =>
      this.scrapeSocialProfile(url, 'Instagram').catch(e => {
        logger.warn(`[ProfileDiscoveryEngine] Instagram scrape failed for ${url}: ${e.message}`);
        return null;
      })
    );

    const facebookUrlsList = Array.from(discoveredFacebookUrls.entries()).slice(0, 3);
    const facebookPromises = facebookUrlsList.map(([url]) =>
      this.scrapeSocialProfile(url, 'Facebook').catch(e => {
        logger.warn(`[ProfileDiscoveryEngine] Facebook scrape failed for ${url}: ${e.message}`);
        return null;
      })
    );

    const twitterUrlsList = Array.from(discoveredTwitterUrls.entries()).slice(0, 3);
    const twitterPromises = twitterUrlsList.map(([url]) =>
      this.scrapeSocialProfile(url, 'Twitter/X').catch(e => {
        logger.warn(`[ProfileDiscoveryEngine] Twitter/X scrape failed for ${url}: ${e.message}`);
        return null;
      })
    );

    const [githubDataArray, companyWebDataArray, portfolioDataArray, instagramDataArray, facebookDataArray, twitterDataArray] = await Promise.all([
      Promise.all(githubPromises),
      Promise.all(companyWebPromises),
      Promise.all(portfolioPromises),
      Promise.all(instagramPromises),
      Promise.all(facebookPromises),
      Promise.all(twitterPromises)
    ]);

    // Update searchProcess logs with API scraper details
    searchProcess["GitHub API"] = `${githubDataArray.filter(Boolean).length} Results`;
    searchProcess["Company Website"] = `${companyWebDataArray.filter(Boolean).length} Results`;
    searchProcess["Instagram Discovery"] = `${discoveredInstagramUrls.size} Found, ${instagramDataArray.filter(Boolean).length} Scraped`;
    searchProcess["Facebook Discovery"] = `${discoveredFacebookUrls.size} Found, ${facebookDataArray.filter(Boolean).length} Scraped`;
    searchProcess["Twitter/X Discovery"] = `${discoveredTwitterUrls.size} Found, ${twitterDataArray.filter(Boolean).length} Scraped`;

    const candidates: CandidateProfile[] = [];

    // Step 6: Add LinkedIn candidates (Do NOT scrape)
    const linkedinUrlsList = Array.from(discoveredLinkedInUrls.entries()).slice(0, 5);
    for (const [url, meta] of linkedinUrlsList) {
      // Evaluate each LinkedIn URL individually using search result metadata
      const urlScore = this.evaluateLinkedInUrlCandidate(signals, url, meta.title, meta.description);
      logger.info(`[ProfileDiscoveryEngine] LinkedIn URL evaluated: ${url} → Score: ${urlScore}%`);
      const parsedTitle = this.parseLinkedInTitle(meta.title, signals.name, signals.company || undefined, signals.designation || undefined);
      candidates.push({
        fullName: parsedTitle.fullName,
        company: parsedTitle.company,
        designation: parsedTitle.designation,
        experience: [],
        education: [],
        skills: [],
        projects: [],
        publicProfiles: [{ platform: 'LinkedIn', url, confidence: urlScore, reasons: [
          `Name match: ${meta.title}`,
          `Search snippet: ${meta.description.substring(0, 80)}`
        ] }],
        source: 'LinkedIn URL Discovery',
        sourceConfidence: urlScore,
        verificationStatus: urlScore >= 70 ? 'Verified' : 'Unverified'
      });
    }

    // Step 7: Add GitHub candidate data
    for (let idx = 0; idx < githubDataArray.length; idx++) {
      const githubData = githubDataArray[idx];
      if (!githubData) continue;
      candidates.push({
        fullName: githubData.name || signals.name,
        company: githubData.company?.replace('@', '').trim() || signals.company || undefined,
        location: githubData.location || undefined,
        headline: githubData.bio || undefined,
        summary: githubData.bio || undefined,
        experience: [],
        education: [],
        skills: githubData.primaryLanguages || [],
        projects: [],
        publicProfiles: [{ platform: 'GitHub', url: githubData.githubUrl }],
        repositories: githubData.repos,
        pinnedRepositories: githubData.pinnedRepos,
        primaryLanguages: githubData.primaryLanguages,
        technologies: githubData.technologies,
        githubStats: {
          followers: githubData.followers,
          following: githubData.following,
          publicRepos: githubData.publicRepos,
          login: githubData.login
        },
        source: 'GitHub API',
        sourceConfidence: 95,
        verificationStatus: 'Verified'
      });
    }

    // Step 8: Add Company website candidate details
    for (let idx = 0; idx < companyWebDataArray.length; idx++) {
      const companyWebData = companyWebDataArray[idx];
      if (!companyWebData) continue;
      const url = companyUrlsList[idx];
      candidates.push({
        fullName: signals.name,
        company: signals.company || companyWebData.companyName || undefined,
        designation: signals.designation || undefined,
        companyBio: companyWebData.about,
        companyRole: companyWebData.leadership?.find((l: any) => stringSimilarity(l.name, signals.name) > 0.6)?.designation,
        companyDepartment: companyWebData.leadership?.find((l: any) => stringSimilarity(l.name, signals.name) > 0.6)?.department,
        experience: [],
        education: [],
        skills: [],
        projects: [],
        publicProfiles: [{ platform: 'Company Website', url }],
        source: 'Company Website',
        sourceConfidence: 90,
        verificationStatus: 'Verified'
      });
    }

    // Step 9: Add Portfolio website candidate details
    for (let idx = 0; idx < portfolioDataArray.length; idx++) {
      const portfolioData = portfolioDataArray[idx];
      if (!portfolioData) continue;
      const url = portfolioUrlsList[idx];
      candidates.push({
        fullName: signals.name,
        experience: portfolioData.experience || [],
        education: portfolioData.education || [],
        skills: portfolioData.skills || [],
        projects: portfolioData.projects || [],
        publicProfiles: [{ platform: 'Portfolio', url }, ...(portfolioData.socialLinks?.map((url: string) => ({ platform: 'Social', url })) || [])],
        technologies: portfolioData.technologies || [],
        source: 'Portfolio Scraper',
        sourceConfidence: 85,
        verificationStatus: 'Verified'
      });
    }

    // Step 10: Add Instagram candidates
    for (let idx = 0; idx < instagramUrlsList.length; idx++) {
      const [url, meta] = instagramUrlsList[idx];
      const socialData = instagramDataArray[idx];
      const urlScore = this.evaluateSocialUrlCandidate(signals, url, meta.title, meta.description, 'Instagram');
      logger.info(`[ProfileDiscoveryEngine] Instagram URL evaluated: ${url} → Score: ${urlScore}%`);
      candidates.push({
        fullName: socialData?.displayName || signals.name,
        company: signals.company || undefined,
        designation: signals.designation || undefined,
        headline: socialData?.bio || undefined,
        summary: socialData?.bio || undefined,
        experience: [],
        education: [],
        skills: [],
        projects: [],
        publicProfiles: [{ platform: 'Instagram', url, confidence: urlScore, reasons: [
          `Name match: ${meta.title}`,
          `Search snippet: ${meta.description.substring(0, 80)}`
        ] }],
        source: 'Instagram Discovery',
        sourceConfidence: urlScore,
        verificationStatus: urlScore >= 70 ? 'Verified' : 'Unverified'
      });
    }

    // Step 11: Add Facebook candidates
    for (let idx = 0; idx < facebookUrlsList.length; idx++) {
      const [url, meta] = facebookUrlsList[idx];
      const socialData = facebookDataArray[idx];
      const urlScore = this.evaluateSocialUrlCandidate(signals, url, meta.title, meta.description, 'Facebook');
      logger.info(`[ProfileDiscoveryEngine] Facebook URL evaluated: ${url} → Score: ${urlScore}%`);
      candidates.push({
        fullName: socialData?.displayName || signals.name,
        company: signals.company || undefined,
        designation: signals.designation || undefined,
        headline: socialData?.bio || undefined,
        summary: socialData?.bio || undefined,
        experience: [],
        education: [],
        skills: [],
        projects: [],
        publicProfiles: [{ platform: 'Facebook', url, confidence: urlScore, reasons: [
          `Name match: ${meta.title}`,
          `Search snippet: ${meta.description.substring(0, 80)}`
        ] }],
        source: 'Facebook Discovery',
        sourceConfidence: urlScore,
        verificationStatus: urlScore >= 70 ? 'Verified' : 'Unverified'
      });
    }

    // Step 12: Add Twitter/X candidates
    for (let idx = 0; idx < twitterUrlsList.length; idx++) {
      const [url, meta] = twitterUrlsList[idx];
      const socialData = twitterDataArray[idx];
      const urlScore = this.evaluateSocialUrlCandidate(signals, url, meta.title, meta.description, 'Twitter/X');
      logger.info(`[ProfileDiscoveryEngine] Twitter/X URL evaluated: ${url} → Score: ${urlScore}%`);
      candidates.push({
        fullName: socialData?.displayName || signals.name,
        company: signals.company || undefined,
        designation: signals.designation || undefined,
        headline: socialData?.bio || undefined,
        summary: socialData?.bio || undefined,
        experience: [],
        education: [],
        skills: [],
        projects: [],
        publicProfiles: [{ platform: 'Twitter/X', url, confidence: urlScore, reasons: [
          `Name match: ${meta.title}`,
          `Search snippet: ${meta.description.substring(0, 80)}`
        ] }],
        source: 'Twitter/X Discovery',
        sourceConfidence: urlScore,
        verificationStatus: urlScore >= 70 ? 'Verified' : 'Unverified'
      });
    }

    return {
      candidates,
      linkedInUrl: linkedinUrlsList[0]?.[0] || null,
      githubUrl: githubUrlsList[0] || null,
      companyWebsiteUrl: companyUrlsList[0] || null,
      searchQueries,
      allDiscoveredUrls,
      rejectionReasons,
      searchProcess
    };
  }

  private parseLinkedInTitle(title: string, defaultName: string, defaultCompany?: string, defaultDesignation?: string): { fullName: string; designation?: string; company?: string } {
    let clean = title.replace(/\s*(\||\-)?\s*LinkedIn/gi, '').replace(/\s*on\s*LinkedIn/gi, '').trim();
    const parts = clean.split(/\s*[\-\–\—]\s*/);
    
    if (parts.length === 0 || !parts[0].trim()) {
      return { fullName: defaultName, company: defaultCompany, designation: defaultDesignation };
    }
    
    const fullName = parts[0].trim();
    
    if (parts.length > 2) {
      return {
        fullName,
        designation: parts[1].trim(),
        company: parts[2].trim()
      };
    } else if (parts.length > 1) {
      const headline = parts[1].trim();
      const atIndex = headline.toLowerCase().lastIndexOf(' at ');
      if (atIndex !== -1) {
        return {
          fullName,
          designation: headline.substring(0, atIndex).trim(),
          company: headline.substring(atIndex + 4).trim()
        };
      }
      return {
        fullName,
        designation: headline,
        company: defaultCompany
      };
    }
    
    return {
      fullName,
      company: defaultCompany,
      designation: defaultDesignation
    };
  }

  private evaluateLinkedInUrlCandidate(signals: IdentitySignals, url: string, title: string, description: string): number {
    let score = 0;
    const lowerTitle = title.toLowerCase();
    const lowerDesc = description.toLowerCase();
    const lowerSlug = url.split('/in/')[1]?.toLowerCase() || '';

    // Name Match
    const nameSim = stringSimilarity(signals.name.toLowerCase(), lowerTitle);
    if (nameSim > 0.5) score += 35;
    const nameParts = signals.name.toLowerCase().split(/\s+/);
    const slugMatches = nameParts.filter(part => lowerSlug.includes(part));
    if (slugMatches.length === nameParts.length) score += 10;

    // Company Match
    if (signals.company) {
      const cleanCompany = signals.company.toLowerCase().replace(/inc|llc|corp|\s/g, '');
      if (lowerTitle.includes(cleanCompany) || lowerDesc.includes(cleanCompany)) {
        score += 30;
      }
    }

    // Designation Match
    if (signals.designation) {
      const cleanDesig = signals.designation.toLowerCase();
      if (lowerTitle.includes(cleanDesig) || lowerDesc.includes(cleanDesig)) {
        score += 15;
      }
    }

    // Domain Match
    if (signals.companyDomain && (lowerTitle.includes(signals.companyDomain) || lowerDesc.includes(signals.companyDomain))) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Evaluate a social media URL candidate (Instagram, Facebook, Twitter/X).
   * Uses the same weighted matching approach as evaluateLinkedInUrlCandidate.
   */
  private evaluateSocialUrlCandidate(signals: IdentitySignals, url: string, title: string, description: string, platform: string): number {
    let score = 0;
    const lowerTitle = title.toLowerCase();
    const lowerDesc = description.toLowerCase();

    // Extract username/slug from URL
    let slug = '';
    if (platform === 'Instagram') {
      const match = url.match(/instagram\.com\/([^\/\?]+)/);
      slug = match ? match[1].toLowerCase() : '';
    } else if (platform === 'Facebook') {
      const match = url.match(/facebook\.com\/([^\/\?]+)/);
      slug = match ? match[1].toLowerCase() : '';
    } else if (platform === 'Twitter/X') {
      const match = url.match(/(?:twitter|x)\.com\/([^\/\?]+)/);
      slug = match ? match[1].toLowerCase() : '';
    }

    // Name Match in title/description
    const nameSim = stringSimilarity(signals.name.toLowerCase(), lowerTitle);
    if (nameSim > 0.5) score += 35;
    else if (nameSim > 0.3) score += 20;

    // Name parts in slug (e.g. username = johnsmith matches "John Smith")
    const nameParts = signals.name.toLowerCase().split(/\s+/);
    const slugClean = slug.replace(/[._-]/g, '');
    const slugMatchCount = nameParts.filter(part => slugClean.includes(part)).length;
    if (slugMatchCount === nameParts.length) score += 15;
    else if (slugMatchCount > 0) score += 8;

    // Company Match
    if (signals.company) {
      const cleanCompany = signals.company.toLowerCase().replace(/inc|llc|corp|\s/g, '');
      if (lowerTitle.includes(cleanCompany) || lowerDesc.includes(cleanCompany)) {
        score += 25;
      }
    }

    // Designation Match
    if (signals.designation) {
      const cleanDesig = signals.designation.toLowerCase();
      if (lowerTitle.includes(cleanDesig) || lowerDesc.includes(cleanDesig)) {
        score += 15;
      }
    }

    // Domain Match
    if (signals.companyDomain && (lowerTitle.includes(signals.companyDomain) || lowerDesc.includes(signals.companyDomain))) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Attempt to scrape public social profile metadata using Cheerio.
   * Only extracts Open Graph / meta tag data — no login bypass.
   */
  private async scrapeSocialProfile(url: string, platform: string): Promise<import('./CheerioParser').SocialProfilePublicData | null> {
    try {
      logger.info(`[ProfileDiscoveryEngine] Attempting public scrape of ${platform} profile: ${url}`);
      const html = await this.cheerioParser.fetchHtml(url);
      return this.cheerioParser.parseSocialProfilePublic(html, platform);
    } catch (e: any) {
      logger.warn(`[ProfileDiscoveryEngine] Public scrape failed for ${platform} ${url}: ${e.message} (profile may be private)`);
      return null;
    }
  }

  private async fetchGitHubDetails(githubUrl: string): Promise<any | null> {
    const parts = githubUrl.replace(/\/$/, '').split('/');
    const login = parts[parts.length - 1];
    if (!login) return null;

    logger.info(`[ProfileDiscoveryEngine] Fetching details from GitHub API for username: ${login}`);
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      'User-Agent': 'Contact-Intelligence-App',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (token) headers['Authorization'] = `token ${token}`;

    const res = await fetch(`https://api.github.com/users/${login}`, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API returned status ${res.status}`);
    }

    const user = await res.json() as any;
    return this.enrichGitHub(user);
  }

  private async enrichGitHub(user: any): Promise<any> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      'User-Agent': 'Contact-Intelligence-App',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (token) headers['Authorization'] = `token ${token}`;

    const login = user.login;
    let repos: any[] = [];
    let orgs: any[] = [];

    try {
      const reposRes = await fetch(`https://api.github.com/users/${login}/repos?sort=stars&per_page=15`, { headers });
      if (reposRes.ok) {
        const reposData = await reposRes.json() as any[];
        repos = reposData.map(r => ({
          name: r.name,
          description: r.description || '',
          language: r.language || '',
          stars: r.stargazers_count || 0,
          forks: r.forks_count || 0,
          url: r.html_url,
          topics: r.topics || []
        }));
      }
    } catch (e) {}

    try {
      const orgsRes = await fetch(`https://api.github.com/users/${login}/orgs?per_page=5`, { headers });
      if (orgsRes.ok) {
        const orgsData = await orgsRes.json() as any[];
        orgs = orgsData.map(o => o.login);
      }
    } catch (e) {}

    const langCounts: Record<string, number> = {};
    for (const repo of repos) {
      if (repo.language) {
        langCounts[repo.language] = (langCounts[repo.language] || 0) + 1;
      }
    }
    const primaryLanguages = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([lang]) => lang);

    const techSet = new Set<string>();
    for (const repo of repos) {
      for (const topic of (repo.topics || [])) {
        techSet.add(topic);
      }
    }
    const technologies = Array.from(techSet).slice(0, 15);

    return {
      login,
      name: user.name || login,
      bio: user.bio || '',
      company: user.company || '',
      location: user.location || '',
      blog: user.blog || '',
      followers: user.followers || 0,
      following: user.following || 0,
      publicRepos: user.public_repos || 0,
      githubUrl: user.html_url,
      repos: repos.slice(0, 10),
      pinnedRepos: repos.slice(0, 6),
      organizations: orgs,
      primaryLanguages,
      technologies
    };
  }

  private async scrapeCompanyWebsite(url: string, name: string): Promise<any> {
    logger.info(`[ProfileDiscoveryEngine] Fetching & parsing Company Web Page: ${url}`);
    const html = await this.cheerioParser.fetchHtml(url);
    return this.cheerioParser.parseCompanyWebsite(html, name);
  }

  private async scrapePortfolio(url: string): Promise<any> {
    logger.info(`[ProfileDiscoveryEngine] Fetching & parsing Portfolio page: ${url}`);
    const html = await this.cheerioParser.fetchHtml(url);
    return this.cheerioParser.parsePortfolio(html);
  }
}
