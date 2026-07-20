import { GoogleGenerativeAI } from '@google/generative-ai';
import Redis from 'ioredis';
import { env } from '../../config/env';
import logger from '../../config/logger';

// Custom Response Error mapping class
class ResponseError extends Error {
  public status: number;
  public statusText: string;

  constructor(status: number, statusText: string, message: string) {
    super(message);
    this.name = 'ResponseError';
    this.status = status;
    this.statusText = statusText;
  }
}

// 1. Unified Interface Specifications
export interface ILinkedInSearchResult {
  salesNavigatorId: string;
  fullName: string;
  company: string;
  designation: string;
  linkedInUrl: string;
  profileImage: string;
}

export interface INormalizedLinkedInProfile {
  salesNavigatorId: string; // Kept for backward compatibility
  fullName: string;
  headline?: string;
  company?: string;
  designation?: string;
  location?: string;
  experience: Array<{ title: string; company: string; period: string }>;
  education: Array<{ school: string; degree: string; year: string }>;
  profileUrl: string;
  profileImage?: string;
  skills: string[];
  summary?: string;
}

export interface ILinkedInProvider {
  search(name: string, company?: string): Promise<ILinkedInSearchResult[]>;
  getDetails(profileId: string): Promise<INormalizedLinkedInProfile>;
}

// 2. Custom Retry Strategy (Exponential Backoff)
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  maxAttempts = 3,
  initialDelay = 1000
): Promise<T> {
  let attempt = 1;
  let delay = initialDelay;

  while (attempt <= maxAttempts) {
    try {
      return await operation();
    } catch (error: any) {
      const status = error.status || (error.response && error.response.status);
      const isAuthError = status === 401 || status === 403;
      const isNotFoundError = status === 404;
      const isValidationError = status === 400 || status === 422;

      logger.warn(`[LinkedIn Retry] Operation "${context}" failed on attempt ${attempt}/${maxAttempts}: ${error.message}`, {
        status,
        isAuthError,
        isNotFoundError,
        isValidationError,
      });

      // Avoid retrying on auth, validation, or not found errors
      if (isAuthError || isNotFoundError || isValidationError) {
        throw error;
      }

      if (attempt === maxAttempts) {
        throw error;
      }

      logger.info(`[LinkedIn Retry] Waiting ${delay}ms before next attempt...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
      delay *= 2; // Exponential backoff
    }
  }
  throw new Error(`[LinkedIn Retry] Operation "${context}" failed after ${maxAttempts} attempts`);
}

// 3. Timeout Wrapper
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      logger.error(`[LinkedIn Timeout] Request timed out after ${timeoutMs}ms`, { url });
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

// 4. Hybrid Redis + In-Memory Caching System
class LinkedInCache {
  private redis: Redis | null = null;
  private memoryCache = new Map<string, { value: any; expiry: number }>();
  private ttlSeconds = env.LINKEDIN_CACHE_TTL;

  constructor() {
    try {
      this.redis = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
      });
      this.redis.on('error', (err) => {
        logger.warn('[LinkedIn Cache] Redis client error, fallback active:', err.message);
      });
    } catch (err: any) {
      logger.warn('[LinkedIn Cache] Redis init failed, memory cache active:', err.message);
    }
  }

  public async get(key: string): Promise<any | null> {
    const cacheKey = `linkedin:profile:${key}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          logger.info('[LinkedIn Cache] Redis cache hit', { key });
          return JSON.parse(cached);
        }
      } catch (err: any) {
        logger.warn('[LinkedIn Cache] Redis get failed, scanning memory cache:', err.message);
      }
    }

    const memCached = this.memoryCache.get(key);
    if (memCached) {
      if (Date.now() < memCached.expiry) {
        logger.info('[LinkedIn Cache] In-memory cache hit', { key });
        return memCached.value;
      }
      this.memoryCache.delete(key);
    }

    return null;
  }

  public async set(key: string, value: any): Promise<void> {
    const cacheKey = `linkedin:profile:${key}`;
    if (this.redis) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(value), 'EX', this.ttlSeconds);
        logger.info('[LinkedIn Cache] Value cached in Redis', { key, ttl: this.ttlSeconds });
        return;
      } catch (err: any) {
        logger.warn('[LinkedIn Cache] Redis set failed:', err.message);
      }
    }

    const expiry = Date.now() + this.ttlSeconds * 1000;
    this.memoryCache.set(key, { value, expiry });
    logger.info('[LinkedIn Cache] Value cached in memory', { key, ttl: this.ttlSeconds });
  }
}

const cacheInstance = new LinkedInCache();

// 5. Public Search Grounding Provider (Gemini based)
export class PublicInfoLinkedInProvider implements ILinkedInProvider {
  private getApiKey(): string | undefined {
    return process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  }

  public async search(name: string, company?: string): Promise<ILinkedInSearchResult[]> {
    logger.info('[LinkedIn] Request started', { provider: 'PublicInfo/Gemini', action: 'search', name, company });
    const apiKey = this.getApiKey();
    if (!apiKey) {
      logger.warn('[LinkedIn] API key missing for PublicInfo search, using mock fallback.');
      return this.getMockSearchResults(name, company);
    }

    const startTime = Date.now();
    const operation = async () => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        tools: [{ googleSearch: {} } as any],
      });

      const prompt = `Search the web using Google Search to find professional profiles matching the following person:
Name: ${name}
${company ? `Company: ${company}` : ''}

CRITICAL INSTRUCTIONS:
- You must find actual search results.
- DO NOT invent, guess, or hallucinate profiles.
- If you cannot find a highly confident match on LinkedIn, return an empty array: []

If you do find a real profile, return a JSON array with up to 3 candidate profiles. For each, retrieve:
1. Full Name (fullName)
2. Current Company (company)
3. Designation / Title (designation)
4. LinkedIn URL (linkedInUrl) - MUST BE A REAL URL
5. profileImage

Construct a salesNavigatorId for each profile using the format 'pub-<name-slug>-<company-slug>'.
Return ONLY a valid raw JSON array of objects.
Do not include markdown code block formatting or backticks.`;

      // Prevent indefinite hanging
      const responsePromise = model.generateContent(prompt);
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Gemini timeout")), 15000));
      const response = await Promise.race([responsePromise, timeoutPromise]) as any;
      const text = response.response.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        const parsed = JSON.parse(cleaned);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        return list.map((item: any) => ({
          salesNavigatorId: item.salesNavigatorId || `pub-${name.toLowerCase().replace(/\s+/g, '')}`,
          fullName: item.fullName || name,
          company: item.company || company || 'Unknown Company',
          designation: item.designation || 'Professional',
          linkedInUrl: item.linkedInUrl || '',
          profileImage: item.profileImage || '',
        }));
      } catch (err) {
        logger.error('[LinkedIn] Unexpected response format during PublicInfo search', { text });
        throw err;
      }
    };

    try {
      const results = await withRetry(operation, `Gemini Search: ${name}`);
      logger.info('[LinkedIn] Request completed', { provider: 'PublicInfo/Gemini', action: 'search', durationMs: Date.now() - startTime });
      return results;
    } catch (err: any) {
      logger.warn('[LinkedIn] Gemini search failed after retries, using mock fallback:', err.message);
      return this.getMockSearchResults(name, company);
    }
  }

  public async getDetails(profileId: string): Promise<INormalizedLinkedInProfile> {
    logger.info('[LinkedIn] Request started', { provider: 'PublicInfo/Gemini', action: 'getDetails', profileId });

    // Check Cache
    const cached = await cacheInstance.get(profileId);
    if (cached) {
      return cached;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      logger.warn('[LinkedIn] API key missing for PublicInfo details, using mock fallback.');
      const details = this.getMockProfileDetails(profileId);
      await cacheInstance.set(profileId, details);
      return details;
    }

    const startTime = Date.now();
    const operation = async () => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        tools: [{ googleSearch: {} } as any],
      });

      const prompt = `Search the web using Google Search to get the detailed professional history for this person/profile reference:
Profile Reference: ${profileId}

CRITICAL INSTRUCTIONS:
- DO NOT hallucinate, invent, or guess details.
- If you cannot verify the person's exact work history (company, title, period) or education (school, degree, year) from actual search results, return empty arrays for experience and education.
- Do not make up URLs.

Retrieve ONLY verified information for:
1. Full Name (fullName)
2. Current Company (company)
3. Designation / Title (designation)
4. LinkedIn URL (profileUrl)
5. headline (headline)
6. location (location)
7. summary (summary)
8. Structured profile data containing:
   - skills (string array)
   - experience (array of objects with fields: title, company, period)
   - education (array of objects with fields: school, degree, year)

Return ONLY a valid JSON object matching these fields, with salesNavigatorId set to '${profileId}'.
Do not include markdown code block formatting or conversational text.`;

      // Prevent indefinite hanging
      const responsePromise = model.generateContent(prompt);
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Gemini timeout")), 20000));
      const response = await Promise.race([responsePromise, timeoutPromise]) as any;
      const text = response.response.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        const parsed = JSON.parse(cleaned);
        const normalized: INormalizedLinkedInProfile = {
          salesNavigatorId: profileId,
          fullName: parsed.fullName || parsed.fullName || 'Unknown Name',
          headline: parsed.headline || parsed.designation || '',
          company: parsed.company || '',
          designation: parsed.designation || parsed.headline || '',
          location: parsed.location || '',
          experience: (parsed.profileData?.experience || parsed.experience || []).map((exp: any) => ({
            title: exp.title || '',
            company: exp.company || '',
            period: exp.period || '',
          })),
          education: (parsed.profileData?.education || parsed.education || []).map((edu: any) => ({
            school: edu.school || '',
            degree: edu.degree || '',
            year: edu.year ? String(edu.year) : '',
          })),
          profileUrl: parsed.profileUrl || parsed.linkedInUrl || `https://www.linkedin.com/in/${profileId}`,
          profileImage: parsed.profileImage || '',
          skills: parsed.profileData?.skills || parsed.skills || [],
          summary: parsed.summary || '',
        };
        return normalized;
      } catch (err) {
        logger.error('[LinkedIn] Unexpected response format during PublicInfo details fetch', { text });
        throw err;
      }
    };

    try {
      const details = await withRetry(operation, `Gemini Details: ${profileId}`);
      await cacheInstance.set(profileId, details);
      logger.info('[LinkedIn] Request completed', { provider: 'PublicInfo/Gemini', action: 'getDetails', durationMs: Date.now() - startTime });
      return details;
    } catch (err: any) {
      logger.warn('[LinkedIn] Gemini details fetch failed after retries, using mock fallback:', err.message);
      const details = this.getMockProfileDetails(profileId);
      await cacheInstance.set(profileId, details);
      return details;
    }
  }

  private getMockSearchResults(name: string, company?: string): ILinkedInSearchResult[] {
    const nameSlug = name.toLowerCase().replace(/\s+/g, '');
    const companyName = company || 'Innovate Tech';
    return [
      {
        salesNavigatorId: `pub-${nameSlug}-1`,
        fullName: name,
        company: companyName,
        designation: 'Professional Specialist',
        linkedInUrl: `https://www.linkedin.com/in/${nameSlug}-specialist`,
        profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      },
    ];
  }

  private getMockProfileDetails(profileId: string): INormalizedLinkedInProfile {
    return {
      salesNavigatorId: profileId,
      fullName: 'Jane Smith',
      headline: 'Director of Product Management',
      company: 'Innovate Tech',
      designation: 'Director of Product Management',
      location: 'San Francisco, CA',
      experience: [
        { title: 'Director of Product', company: 'Innovate Tech', period: '2023 - Present' },
        { title: 'Senior Product Manager', company: 'SaaSify Inc', period: '2020 - 2023' },
      ],
      education: [
        { school: 'MIT Sloan School of Management', degree: 'MBA', year: '2020' },
        { school: 'University of Texas at Austin', degree: 'BS in Computer Science', year: '2016' },
      ],
      profileUrl: 'https://www.linkedin.com/in/janesmith-innovate',
      profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      skills: ['Product Strategy', 'Agile Methodologies', 'TypeScript', 'Growth Marketing'],
      summary: 'Experienced product leader specializing in B2B SaaS and developer tools.',
    };
  }
}

// 6. RapidAPI Fresh LinkedIn Profile Scraper Provider
export class RapidApiLinkedInProvider implements ILinkedInProvider {
  private getApiKey(): string | undefined {
    return env.RAPIDAPI_KEY;
  }

  public async search(name: string, company?: string): Promise<ILinkedInSearchResult[]> {
    logger.info('[LinkedIn] Request started', { provider: 'RapidApi', action: 'search', name, company });
    const apiKey = this.getApiKey();
    if (!apiKey) {
      logger.warn('[LinkedIn] RapidAPI key missing (RAPIDAPI_KEY is not defined in env). Throwing to trigger fallback chain.');
      throw new Error('RapidAPI Key is not configured.');
    }

    const url = new URL(`https://${env.RAPIDAPI_HOST}/search-people`);
    url.searchParams.append('name', name);
    if (company) {
      url.searchParams.append('company_name', company);
    }

    const startTime = Date.now();
    const operation = async () => {
      const response = await fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': env.RAPIDAPI_HOST,
        },
      }, 10000);

      if (!response.ok) {
        if (response.status === 429) {
          logger.error('[LinkedIn] RapidAPI quota/rate limit exceeded (429)');
        }
        throw new ResponseError(response.status, response.statusText, `RapidAPI search failed with status: ${response.status}`);
      }

      const resBody: any = await response.json();
      if (!resBody || typeof resBody !== 'object') {
        logger.error('[LinkedIn] Unexpected response format from RapidAPI search', { resBody });
        throw new Error('Invalid RapidAPI JSON response structure.');
      }

      const results = resBody.data || [];
      return results.map((item: any) => {
        const linkedinUrl = item.linkedin_url || '';
        const parts = linkedinUrl.replace(/\/$/, '').split('/');
        const username = parts[parts.length - 1] || `user-${Date.now()}`;

        return {
          salesNavigatorId: username,
          fullName: item.full_name || item.name || name,
          company: item.company || company || 'Unknown Company',
          designation: item.title || item.headline || 'Professional',
          linkedInUrl: linkedinUrl,
          profileImage: item.profile_image || item.profile_pic_url || '',
        };
      });
    };

    try {
      const results = await withRetry(operation, `RapidAPI Search: ${name}`);
      logger.info('[LinkedIn] Request completed', { provider: 'RapidApi', action: 'search', durationMs: Date.now() - startTime });
      return results;
    } catch (err: any) {
      logger.warn('[LinkedIn] RapidAPI search failed, raising error to activate fallback provider:', err.message);
      throw err;
    }
  }

  public async getDetails(profileId: string): Promise<INormalizedLinkedInProfile> {
    logger.info('[LinkedIn] Request started', { provider: 'RapidApi', action: 'getDetails', profileId });

    // Check Cache
    const cached = await cacheInstance.get(profileId);
    if (cached) {
      return cached;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      logger.warn('[LinkedIn] RapidAPI key missing (RAPIDAPI_KEY is not defined in env). Throwing to trigger fallback chain.');
      throw new Error('RapidAPI Key is not configured.');
    }

    const profileUrl = profileId.startsWith('http') ? profileId : `https://www.linkedin.com/in/${profileId}`;
    const url = new URL(`https://${env.RAPIDAPI_HOST}/get-linkedin-profile`);
    url.searchParams.append('linkedin_url', profileUrl);

    const startTime = Date.now();
    const operation = async () => {
      const response = await fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': env.RAPIDAPI_HOST,
        },
      }, 10000);

      if (!response.ok) {
        if (response.status === 429) {
          logger.error('[LinkedIn] RapidAPI quota/rate limit exceeded (429)');
        }
        throw new ResponseError(response.status, response.statusText, `RapidAPI profile details failed with status: ${response.status}`);
      }

      const resBody: any = await response.json();
      const data = resBody.data;
      if (!data) {
        logger.error('[LinkedIn] Unexpected response format from RapidAPI details', { resBody });
        throw new Error('No profile data returned in RapidAPI response');
      }

      const normalized: INormalizedLinkedInProfile = {
        salesNavigatorId: profileId,
        fullName: data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown Name',
        headline: data.headline || '',
        company: data.company || (data.experiences && data.experiences[0]?.company_name) || '',
        designation: data.headline || (data.experiences && data.experiences[0]?.title) || '',
        location: data.location || '',
        experience: (data.experiences || []).map((exp: any) => ({
          title: exp.title || '',
          company: exp.company_name || exp.company || '',
          period: exp.date_range || `${exp.starts_at?.year || ''} - ${exp.ends_at?.year || 'Present'}`,
        })),
        education: (data.educations || data.education || []).map((edu: any) => ({
          school: edu.school_name || edu.school || '',
          degree: edu.degree_name || edu.degree || '',
          year: edu.date_range || (edu.ends_at?.year ? String(edu.ends_at.year) : ''),
        })),
        profileUrl: profileUrl,
        profileImage: data.profile_image || data.profile_pic_url || '',
        skills: data.skills || [],
        summary: data.summary || '',
      };
      return normalized;
    };

    try {
      const details = await withRetry(operation, `RapidAPI Details: ${profileId}`);
      await cacheInstance.set(profileId, details);
      logger.info('[LinkedIn] Request completed', { provider: 'RapidApi', action: 'getDetails', durationMs: Date.now() - startTime });
      return details;
    } catch (err: any) {
      logger.warn('[LinkedIn] RapidAPI details fetch failed, raising error to activate fallback provider:', err.message);
      throw err;
    }
  }
}
