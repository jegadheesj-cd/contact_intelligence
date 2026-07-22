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
    
    let linkedInUrl: string | null = null;
    let githubUrl: string | null = null;
    let companyWebsiteUrl: string | null = null;
    let linkedinConfidence = 0;
    let linkedinVerificationStatus = 'Unverified';

    // 1. Check for direct LinkedIn URL on the card
    if (signals.website && signals.website.includes('linkedin.com/in/')) {
      linkedInUrl = signals.website;
      linkedinConfidence = 100;
      linkedinVerificationStatus = 'Verified';
      logger.info(`[ProfileDiscoveryEngine] Direct LinkedIn URL found: ${linkedInUrl}`);
      allDiscoveredUrls.push({ url: linkedInUrl, source: 'business-card-direct' });
    }

    logger.info(`[ProfileDiscoveryEngine] Executing stage: Search Query Builder`);
    const linkedinQueries = this.queryBuilder.buildLinkedInQueries(signals);
    const githubQueries = this.queryBuilder.buildGitHubQueries(signals);
    const companyQueries = this.queryBuilder.buildCompanyQueries(signals);

    // 2. Discover LinkedIn URL via queries if not found directly
    if (!linkedInUrl) {
      let bestCandidateScore = 0;
      let bestCandidateUrl = '';

      for (const query of linkedinQueries) {
        searchQueries.push(query);
        try {
          logger.info(`[ProfileDiscoveryEngine] Executing search query: "${query}"`);
          const results = await this.searchAdapter.search(query);

          for (const res of results) {
            if (res.url.includes('linkedin.com/in/')) {
              allDiscoveredUrls.push({ url: res.url, source: 'linkedin-discovery-search' });
              const score = this.evaluateLinkedInUrlCandidate(signals, res.url, res.title, res.snippet);
              if (score > bestCandidateScore) {
                bestCandidateScore = score;
                bestCandidateUrl = res.url;
              }
            }
          }
        } catch (e: any) {
          logger.warn(`[ProfileDiscoveryEngine] LinkedIn Search failed: ${e.message}`);
          rejectionReasons.push(`LinkedIn discovery query "${query}" failed: ${e.message}`);
        }
      }

      if (bestCandidateUrl && bestCandidateScore >= 40) {
        linkedInUrl = bestCandidateUrl;
        linkedinConfidence = bestCandidateScore;
        linkedinVerificationStatus = bestCandidateScore >= 70 ? 'Verified' : 'Unverified';
        logger.info(`[ProfileDiscoveryEngine] Discovered LinkedIn URL: ${linkedInUrl} (Confidence: ${linkedinConfidence}%)`);
      }
    }

    // 3. Discover Company Website
    if (signals.website && !signals.website.includes('linkedin.com') && !signals.website.includes('github.com')) {
      companyWebsiteUrl = signals.website;
    } else {
      for (const query of companyQueries) {
        if (companyWebsiteUrl) break;
        searchQueries.push(query);
        try {
          logger.info(`[ProfileDiscoveryEngine] Searching for Company Website using query: "${query}"`);
          const results = await this.searchAdapter.search(query);
          for (const res of results) {
            if (res.url && !res.url.includes('linkedin.com') && !res.url.includes('github.com') && !res.url.includes('wikipedia.org')) {
              companyWebsiteUrl = res.url;
              allDiscoveredUrls.push({ url: res.url, source: 'company-website-search' });
              break;
            }
          }
        } catch (e: any) {
          logger.warn(`[ProfileDiscoveryEngine] Company Web Search query failed: ${e.message}`);
        }
      }
    }

    // 4. Discover GitHub URL
    for (const query of githubQueries) {
      if (githubUrl) break;
      searchQueries.push(query);
      try {
        logger.info(`[ProfileDiscoveryEngine] Searching for GitHub URL using query: "${query}"`);
        const results = await this.searchAdapter.search(query);
        for (const res of results) {
          if (res.url.includes('github.com/') && !res.url.includes('/search') && !res.url.includes('/topics')) {
            githubUrl = res.url;
            allDiscoveredUrls.push({ url: res.url, source: 'github-url-search' });
            break;
          }
        }
      } catch (e: any) {
        logger.warn(`[ProfileDiscoveryEngine] GitHub URL search query failed: ${e.message}`);
      }
    }

    // ─── Parallel Ingestions / BeautifulSoup Parsers ──────────────────────────
    logger.info(`[ProfileDiscoveryEngine] Executing stage: Evidence Collection & BeautifulSoup Parsing`);

    const githubPromise = githubUrl ?
      this.fetchGitHubDetails(githubUrl).catch(e => {
        logger.error(`[ProfileDiscoveryEngine] GitHub Collector failure for ${githubUrl}: ${e.message}`);
        rejectionReasons.push(`GitHub Collector URL "${githubUrl}" error: ${e.message}`);
        return null;
      }) : Promise.resolve(null);

    const companyWebPromise = companyWebsiteUrl ?
      this.scrapeCompanyWebsite(companyWebsiteUrl, signals.name).catch(e => {
        logger.error(`[ProfileDiscoveryEngine] Cheerio Web Scraper failure for ${companyWebsiteUrl}: ${e.message}`);
        rejectionReasons.push(`Company Web Parser URL "${companyWebsiteUrl}" error: ${e.message}`);
        return null;
      }) : Promise.resolve(null);

    // Also search other portfolios or personal sites from general queries if available
    let portfolioData = null;
    if (signals.name) {
      const portQuery = `"${signals.name}" portfolio OR personal website`;
      try {
        logger.info(`[ProfileDiscoveryEngine] Searching for Portfolios using query: "${portQuery}"`);
        const results = await this.searchAdapter.search(portQuery);
        const bestPortUrl = results.find(res => !res.url.includes('linkedin.com') && !res.url.includes('github.com') && !res.url.includes('wikipedia.org'))?.url;
        if (bestPortUrl) {
          logger.info(`[ProfileDiscoveryEngine] Found Candidate Portfolio URL: ${bestPortUrl}. Scraping...`);
          portfolioData = await this.scrapePortfolio(bestPortUrl).catch(e => {
            logger.error(`[ProfileDiscoveryEngine] Portfolio Parser failure for ${bestPortUrl}: ${e.message}`);
            return null;
          });
        }
      } catch (e: any) {
        logger.warn(`[ProfileDiscoveryEngine] Portfolio discovery query failed: ${e.message}`);
      }
    }

    const [githubData, companyWebData] = await Promise.all([
      githubPromise,
      companyWebPromise
    ]);

    const candidates: CandidateProfile[] = [];

    // Step 6: Add LinkedIn stub (Do NOT scrape)
    if (linkedInUrl) {
      candidates.push({
        fullName: signals.name,
        company: signals.company || undefined,
        designation: signals.designation || undefined,
        experience: [],
        education: [],
        skills: [],
        projects: [],
        publicProfiles: [{ platform: 'LinkedIn', url: linkedInUrl }],
        source: 'LinkedIn URL Discovery',
        sourceConfidence: linkedinConfidence,
        verificationStatus: linkedinVerificationStatus
      });
    }

    // Step 7: Add GitHub candidate data
    if (githubData) {
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
    if (companyWebData) {
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
        publicProfiles: companyWebsiteUrl ? [{ platform: 'Company Website', url: companyWebsiteUrl }] : [],
        source: 'Company Website',
        sourceConfidence: 90,
        verificationStatus: 'Verified'
      });
    }

    // Step 9: Add Portfolio website candidate details
    if (portfolioData) {
      candidates.push({
        fullName: signals.name,
        experience: portfolioData.experience || [],
        education: portfolioData.education || [],
        skills: portfolioData.skills || [],
        projects: portfolioData.projects || [],
        publicProfiles: portfolioData.socialLinks?.map((url: string) => ({ platform: 'Social', url })) || [],
        technologies: portfolioData.technologies || [],
        source: 'Portfolio Scraper',
        sourceConfidence: 85,
        verificationStatus: 'Verified'
      });
    }

    return {
      candidates,
      linkedInUrl,
      githubUrl,
      companyWebsiteUrl,
      searchQueries,
      allDiscoveredUrls,
      rejectionReasons
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
