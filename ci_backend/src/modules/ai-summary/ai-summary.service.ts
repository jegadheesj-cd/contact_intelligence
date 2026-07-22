import prisma from '../../config/db';
import { AppError } from '../../utils/AppError';
import { JobStatus } from '@prisma/client';
import logger from '../../config/logger';
import { generateTextWithFallback } from '../../utils/aiClient';

// Timeout helper
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage = 'AI summary generation timed out'): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

// Retry helper
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

export class AiSummaryService {
  public async generateSummary(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
      include: {
        tags: true,
        notes: true,
        professionalProfile: true
      },
    });

    if (!contact) {
      throw new AppError('Contact not found or access denied', 404);
    }

    const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AppError('API key missing for AI Summary Generation', 500);
    }

    // Pass strictly verified profile data mapped to flat values
    let verifiedProfile: any = null;
    if (contact.professionalProfile?.mergedProfile) {
      const merged = contact.professionalProfile.mergedProfile as any;
      const flat: any = {};
      for (const [key, val] of Object.entries(merged)) {
        if (val && typeof val === 'object' && 'value' in val) {
          flat[key] = (val as any).value;
        } else {
          flat[key] = val;
        }
      }
      verifiedProfile = flat;
    }

    const executeLlmGeneration = async () => {
      const notesContent = contact.notes.map(n => n.content).join('; ');
      const tagsList = contact.tags.map(t => t.name).join(', ');

      const prompt = `You are a strict Professional Analyst and Executive Assistant.
Your task is to analyze the following profile data and extract key insights.
You must ONLY use the provided input. Do NOT invent, guess, or hallucinate information. If the information is not present in the input, leave it empty or omit it.

INPUT DATA:
Name: ${contact.name}
Company: ${contact.company || 'Unknown'}
Designation: ${contact.designation || 'Unknown'}
Contact Source: ${contact.source}
Tags: ${tagsList || 'None'}
Meeting Notes: ${notesContent || 'None'}
Profile Data (JSON):
${verifiedProfile ? JSON.stringify(verifiedProfile) : 'No profile data available.'}

Output ONLY a valid JSON object matching this exact format:
{
  "executiveSummary": "A concise professional background summary (2-3 sentences).",
  "careerHighlights": ["Highlight 1", "Highlight 2"],
  "conversationStarters": ["Starter Idea 1", "Starter Idea 2"],
  "meetingPreparation": "A brief overview preparing for a meeting with them.",
  "professionalStrengths": ["Strength 1", "Strength 2"],
  "networkingSuggestions": "Suggestions on how to build a professional relationship with them.",
  "decisionMakerExplanation": "Explanation of why they are or are not a decision maker based on designation/role."
}
Do not include markdown blocks or any conversational text.`;

      const text = await generateTextWithFallback(prompt, 'gemini-2.0-flash', 'AI Summary');
      
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      return JSON.stringify(parsed);
    };

    let summaryText = '';
    try {
      summaryText = await retryWithBackoff(() => 
        withTimeout(executeLlmGeneration(), 15000, 'AI summary generation timed out')
      );
    } catch (err: any) {
      logger.error(`[AI Summary] LLM generation failed:`);
      logger.error(err.stack || err.message);
      summaryText = JSON.stringify({
        executiveSummary: 'AI generation failed due to API rate limits or quota exhaustion.',
        professionalHighlights: [],
        careerSummary: 'Failed to generate career progression summary due to API limitations.',
        decisionMakerExplanation: 'Unable to analyze decision-making tier.',
        conversationStarters: [],
        networkingSuggestions: 'No suggestions available at this time.',
        professionalStrengths: []
      });
    }

    // Save/update summary record
    const summaryRecord = await prisma.aISummary.upsert({
      where: { contactId },
      create: {
        contactId,
        summaryText: summaryText,
        status: JobStatus.COMPLETED,
      },
      update: {
        summaryText: summaryText,
        status: JobStatus.COMPLETED,
      },
    });

    return summaryRecord;
  }
}
