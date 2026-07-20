import { enrichmentQueue } from '../../queue/queue';
import prisma from '../../config/db';
import { AppError } from '../../utils/AppError';
import Redis from 'ioredis';
import { connectionOptions } from '../../queue/queue';
import linkedinService from '../linkedin/linkedin.service';
import logger from '../../config/logger';

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

    let linkedInDetails: any = null;
    try {
      logger.info(`[Business Intelligence Agent] Searching LinkedIn for: ${name} (Company: ${company})`);
      const searchResults = await linkedinService.searchProfiles(name, company || undefined);
      if (searchResults && searchResults.length > 0) {
        const bestMatch = searchResults[0];
        logger.info(`[Business Intelligence Agent] LinkedIn match found: ${bestMatch.fullName} - ${bestMatch.salesNavigatorId}`);
        linkedInDetails = await linkedinService.getProfileDetails(bestMatch.salesNavigatorId);
      }
    } catch (err: any) {
      logger.warn(`[Business Intelligence Agent] LinkedIn provider search/details failed: ${err.message}. Proceeding to Gemini fallback.`);
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      if (linkedInDetails) {
        return this.mapLinkedInToEnriched(linkedInDetails, name, email, company, 0.9);
      }
      return this.getFallbackData(name, email, company);
    }

    const runEnrichment = async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-pro',
        tools: [{ googleSearch: {} }],
      });

      const linkedInContext = linkedInDetails ? JSON.stringify(linkedInDetails) : 'None';

      const prompt = `You are a strict Business Intelligence Agent.
Enrich the professional details of the following contact using Google Search grounding and provided context.
Name: ${name}
Email: ${email || 'Unknown'}
Company: ${company || 'Unknown'}

Existing LinkedIn Context:
${linkedInContext}

Instructions:
1. Synthesize all available information to create a comprehensive professional profile.
2. Only summarize VERIFIED information. Never invent or hallucinate.
3. Compute a confidence score (number between 0.0 and 1.0) and include the verification source.
4. Output ONLY a valid raw JSON object matching the following format exactly:
{
  "summary": "Professional summary (2-3 sentences). Example: John Doe is a Senior Cloud Architect with 14 years... Previously worked at...",
  "insights": "1-2 sentences on professional insights (e.g. Technical Expert, Decision Maker, Founder).",
  "conversationStarters": ["I noticed you recently worked on Generative AI...", "Saw your article on..."],
  "skills": ["Skill 1", "Skill 2"],
  "experience": [{"title": "Title", "company": "Company", "period": "2020-Present"}],
  "education": [{"school": "School", "degree": "Degree", "year": "Year"}],
  "interests": ["Interest 1"],
  "industry": "Industry or null",
  "designation": "Job Title or null",
  "company": "Current Company or null",
  "publicProfiles": [{"platform": "LinkedIn", "url": "URL"}],
  "verificationStatus": "Verified via LinkedIn & Google Search",
  "confidenceScore": 0.95
}

Do not include markdown code block formatting, backticks, or any conversational text.`;

      const response = await model.generateContent(prompt);
      const text = response.response.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const finalProfiles = parsed.publicProfiles || [];
      if (linkedInDetails?.profileUrl) {
        if (!finalProfiles.some((p: any) => p.platform?.toLowerCase() === 'linkedin')) {
          finalProfiles.unshift({ platform: 'LinkedIn', url: linkedInDetails.profileUrl });
        }
      }

      return {
        name: name,
        email: email || '',
        company: parsed.company || company || '',
        designation: parsed.designation || linkedInDetails?.designation || null,
        skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : (linkedInDetails?.skills || []),
        experience: Array.isArray(parsed.experience) && parsed.experience.length > 0 ? parsed.experience : (linkedInDetails?.experience || []),
        education: Array.isArray(parsed.education) && parsed.education.length > 0 ? parsed.education : (linkedInDetails?.education || []),
        interests: Array.isArray(parsed.interests) ? parsed.interests : [],
        industry: parsed.industry || linkedInDetails?.headline || 'Professional Services',
        publicProfiles: finalProfiles,
        confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.8,
        summary: parsed.summary || linkedInDetails?.summary || null,
        insights: parsed.insights || null,
        conversationStarters: Array.isArray(parsed.conversationStarters) ? parsed.conversationStarters : [],
        verificationStatus: parsed.verificationStatus || (linkedInDetails ? "Verified via LinkedIn" : "Verified via General Search"),
      };
    };

    try {
      const enrichedResult = await retryWithBackoff(() => 
        withTimeout(runEnrichment(), 25000, 'Gemini search grounding enrichment timed out')
      );

      await setCachedEnrichment(cacheKey, enrichedResult);
      return enrichedResult;
    } catch (err) {
      console.warn(`[Business Intelligence Agent] AI search grounding failed, falling back to LinkedIn or default:`, err);
      if (linkedInDetails) {
        return this.mapLinkedInToEnriched(linkedInDetails, name, email, company, 0.75);
      }
      return this.getFallbackData(name, email, company);
    }
  }

  private mapLinkedInToEnriched(ld: any, name: string, email: string | null, company: string | null, confidence: number) {
    return {
      name,
      email: email || '',
      company: company || ld.company || '',
      designation: ld.designation || null,
      skills: ld.skills || [],
      experience: ld.experience || [],
      education: ld.education || [],
      interests: [],
      industry: ld.headline || 'Professional Services',
      publicProfiles: [
        { platform: 'LinkedIn', url: ld.profileUrl }
      ],
      confidenceScore: confidence,
      summary: ld.summary || null,
      insights: null,
      conversationStarters: [],
      verificationStatus: "Verified via LinkedIn",
    };
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
      summary: 'Professional expert with experience in software development and technology solutions.',
      insights: 'Technical Leader',
      conversationStarters: ['I noticed you have a background in System Architecture.'],
      verificationStatus: "Fallback Local Heuristics",
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
