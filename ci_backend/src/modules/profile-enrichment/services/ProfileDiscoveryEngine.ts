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
  publicProfiles: Array<{ platform: string; url: string }>;
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
    
    const discoveredLinkedInUrls = new Set<string>();
    const discoveredGitHubUrls = new Set<string>();
    const discoveredCompanyUrls = new Set<string>();
    const discoveredPortfolioUrls = new Set<string>();

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
      discoveredLinkedInUrls.add(signals.website);
      allDiscoveredUrls.push({ url: signals.website, source: 'business-card-direct' });
    }

    logger.info(`[ProfileDiscoveryEngine] Executing stage: Search Query Builder`);
    const linkedinQueries = this.queryBuilder.buildLinkedInQueries(signals);
    const githubQueries = this.queryBuilder.buildGitHubQueries(signals);
    const companyQueries = this.queryBuilder.buildCompanyQueries(signals);

    // 2. Discover LinkedIn URLs via queries
    for (const query of linkedinQueries) {
      searchQueries.push(query);
      try {
        logger.info(`[ProfileDiscoveryEngine] Executing search query: "${query}"`);
        const results = await this.searchAdapter.search(query);
        trackSearchProviderResults(results);

        for (const res of results) {
          if (res.url.includes('linkedin.com/in/')) {
            discoveredLinkedInUrls.add(res.url);
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

    const [githubDataArray, companyWebDataArray, portfolioDataArray] = await Promise.all([
      Promise.all(githubPromises),
      Promise.all(companyWebPromises),
      Promise.all(portfolioPromises)
    ]);

    // Update searchProcess logs with API scraper details
    searchProcess["GitHub API"] = `${githubDataArray.filter(Boolean).length} Results`;
    searchProcess["Company Website"] = `${companyWebDataArray.filter(Boolean).length} Results`;

    const candidates: CandidateProfile[] = [];

    // Step 6: Add LinkedIn candidates (Do NOT scrape)
    const linkedinUrlsList = Array.from(discoveredLinkedInUrls).slice(0, 5);
    for (const url of linkedinUrlsList) {
      candidates.push({
        fullName: signals.name,
        company: signals.company || undefined,
        designation: signals.designation || undefined,
        experience: [],
        education: [],
        skills: [],
        projects: [],
        publicProfiles: [{ platform: 'LinkedIn', url }],
        source: 'LinkedIn URL Discovery',
        sourceConfidence: 80,
        verificationStatus: 'Unverified'
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

    return {
      candidates,
      linkedInUrl: linkedinUrlsList[0] || null,
      githubUrl: githubUrlsList[0] || null,
      companyWebsiteUrl: companyUrlsList[0] || null,
      searchQueries,
      allDiscoveredUrls,
      rejectionReasons,
      searchProcess
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
