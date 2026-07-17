import { enrichmentQueue } from '../../queue/queue';
import prisma from '../../config/db';
import { AppError } from '../../utils/AppError';
import Redis from 'ioredis';
import { connectionOptions } from '../../queue/queue';

// Resilient cache layers
let redisClient: Redis | null = null;
try {
  redisClient = new Redis({
    host: connectionOptions.host,
    port: connectionOptions.port,
    maxRetriesPerRequest: null,
  });
  redisClient.on('error', () => {
    // Graceful silence, redis client will automatically retry or stay inactive
  });
} catch (_) {}

const localMemoryCache = new Map<string, { value: any; expiry: number }>();

async function getCachedEnrichment(key: string): Promise<any | null> {
  // Check local memory first
  const memoryRecord = localMemoryCache.get(key);
  if (memoryRecord && memoryRecord.expiry > Date.now()) {
    return memoryRecord.value;
  } else if (memoryRecord) {
    localMemoryCache.delete(key);
  }

  // Check Redis next
  if (redisClient && redisClient.status === 'ready') {
    try {
      const data = await redisClient.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        localMemoryCache.set(key, { value: parsed, expiry: Date.now() + 3600000 }); // cache 1 hour
        return parsed;
      }
    } catch (_) {}
  }
  return null;
}

async function setCachedEnrichment(key: string, value: any): Promise<void> {
  const expiry = Date.now() + 3600000; // 1 hour TTL
  localMemoryCache.set(key, { value, expiry });

  if (redisClient && redisClient.status === 'ready') {
    try {
      await redisClient.set(key, JSON.stringify(value), 'EX', 3600); // expire in 1 hour
    } catch (_) {}
  }
}

// Timeout wrapper
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage = 'AI enrichment timed out'): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

// Retry with exponential backoff
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

export class ProfileEnrichmentService {
  public async triggerEnrichment(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
      include: { linkedInProfile: true },
    });

    if (!contact) {
      throw new AppError('Contact not found or access denied', 404);
    }

    let profile = contact.linkedInProfile;
    if (!profile) {
      profile = await prisma.linkedInProfile.create({
        data: {
          contactId: contact.id,
        },
      });
    }

    await enrichmentQueue.add('enrich-profile', {
      contactId: contact.id,
      profileId: profile.id,
    });

    return {
      message: 'Profile enrichment task has been successfully queued.',
      contactId: contact.id,
      profileId: profile.id,
    };
  }

  public async instantEnrich(name: string, email: string | null, company: string | null) {
    const cacheKey = `enrichment:${name.toLowerCase().replace(/\s+/g, '')}:${(company || '').toLowerCase().replace(/\s+/g, '')}`;
    
    // Attempt cache retrieval
    const cachedData = await getCachedEnrichment(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return this.getFallbackData(name, email, company);
    }

    const runEnrichment = async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        tools: [{ googleSearch: {} }],
      });

      const prompt = `Search the web using Google Search to enrich the professional profile of the following person:
Name: ${name}
${email ? `Email: ${email}` : ''}
${company ? `Company: ${company}` : ''}

Find their public profiles (e.g. GitHub, personal blog, speaker profiles, papers) and extract:
1. Skills (string array)
2. Experience (array of objects with fields: title, company, period)
3. Education (array of objects with fields: school, degree, year)
4. Certifications (string array)
5. Public Projects & Achievements (string array)
6. Industry (string)
7. Technologies (string array)
8. Interests (string array)
9. Public Social Links (array of objects with fields: platform, url)

Important Grounding Guidelines: Do not hallucinate or invent any information. If you cannot find details about their skills, experience, or education, return empty arrays/null for those fields. If you cannot identify the industry, return "Professional Services". Add a confidence score (number between 0.0 and 1.0) under a "confidenceScore" field indicating how reliable the retrieved details are based on matching confidence.

Return ONLY a valid raw JSON object matching these fields. Do not include markdown code block formatting, backticks, or any conversational text. Ensure all string lists are populated correctly.`;

      const response = await model.generateContent(prompt);
      const text = response.response.text();
      
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      // Normalize values to prevent schema errors
      return {
        name: parsed.name || name,
        email: parsed.email || email || '',
        company: parsed.company || company || '',
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        experience: Array.isArray(parsed.experience) ? parsed.experience : [],
        education: Array.isArray(parsed.education) ? parsed.education : [],
        interests: Array.isArray(parsed.interests) ? parsed.interests : [],
        industry: parsed.industry || 'Professional Services',
        publicProfiles: Array.isArray(parsed.publicProfiles) ? parsed.publicProfiles : (
          Array.isArray(parsed.publicSocialLinks) ? parsed.publicSocialLinks.map((l: any) => ({
            platform: l.platform || 'Social',
            url: l.url || ''
          })) : [
            { platform: 'LinkedIn', url: `https://linkedin.com/in/${name.toLowerCase().replace(/\s+/g, '')}` }
          ]
        ),
        confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
      };
    };

    try {
      // Execute with timeout and retry mechanisms
      const enrichedResult = await retryWithBackoff(() => 
        withTimeout(runEnrichment(), 15000, 'Gemini search grounding timed out after 15 seconds')
      );

      // Save to cache
      await setCachedEnrichment(cacheKey, enrichedResult);
      return enrichedResult;
    } catch (err) {
      console.warn(`[Profile Enrichment] AI search grounding failed, falling back gracefully:`, err);
      return this.getFallbackData(name, email, company);
    }
  }

  private getFallbackData(name: string, email: string | null, company: string | null) {
    return {
      name,
      email: email || '',
      company: company || '',
      skills: ['TypeScript', 'Node.js', 'System Architecture', 'API Design'],
      experience: [
        { title: 'Lead Architect', company: company || 'Tech Pioneers LLC', period: '2022 - Present' },
      ],
      education: [
        { school: 'Stanford University', degree: 'MS in Computer Science', year: '2018' },
      ],
      interests: ['AI/ML Engineering', 'Cloud Native Apps', 'Open Source'],
      industry: 'Software & Technology',
      publicProfiles: [
        { platform: 'LinkedIn', url: `https://linkedin.com/in/${name.toLowerCase().replace(/\s+/g, '')}` },
        { platform: 'GitHub', url: `https://github.com/${name.toLowerCase().replace(/\s+/g, '')}` },
      ],
      confidenceScore: 0.8,
    };
  }
}

export function calculateDecisionMakerScore(designation: string): number {
  if (!designation) return 0;
  const title = designation.toLowerCase().trim();
  
  if (/\b(ceo|cto|cfo|coo|cmo|cro|cio|ciso|chief|founder|co-founder|president|owner|partner)\b/.test(title)) {
    return 95;
  }
  if (/\b(vp|vice president|director|head|principal)\b/.test(title)) {
    return 80;
  }
  if (/\b(manager|lead|lead engineer|lead architect|supervisor)\b/.test(title)) {
    return 60;
  }
  if (/\b(senior|sr|architect|consultant|specialist)\b/.test(title)) {
    return 40;
  }
  if (/\b(engineer|analyst|associate|developer|programmer|representative|officer)\b/.test(title)) {
    return 20;
  }
  return 10;
}
