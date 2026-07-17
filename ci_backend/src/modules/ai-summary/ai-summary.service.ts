import prisma from '../../config/db';
import { AppError } from '../../utils/AppError';
import { JobStatus } from '@prisma/client';

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
      },
    });

    if (!contact) {
      throw new AppError('Contact not found or access denied', 404);
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    let summaryText = '';

    const executeLlmGeneration = async () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const notesContent = contact.notes.map(n => n.content).join('; ');
      const tagsList = contact.tags.map(t => t.name).join(', ');

      const prompt = `Compile a professional summary for the following contact profile:
Name: ${contact.name}
Company: ${contact.company || 'Unknown'}
Designation: ${contact.designation || 'Professional'}
Skills: ${contact.skills.join(', ') || 'Various'}
Source: ${contact.source}
Tags: ${tagsList || 'None'}
Meeting Notes: ${notesContent || 'None'}

Please formulate a highly polished professional analysis. Output ONLY a valid raw JSON object matching the following keys:
{
  "summary": "A concise professional background summary (2-3 sentences) in a polished tone.",
  "collaborationAlignment": "1-2 sentences on how to best align or collaborate with this person based on notes/tags/skills.",
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"]
}

Do not include markdown code block formatting, backticks, or any conversational text.`;

      const response = await model.generateContent(prompt);
      const text = response.response.text().trim();
      
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      if (!parsed.summary || !parsed.collaborationAlignment) {
        throw new Error('Invalid JSON structure returned by AI model.');
      }

      // Combine structured JSON values into a premium paragraph summary
      const strengthsText = Array.isArray(parsed.keyStrengths) && parsed.keyStrengths.length > 0
        ? ` Key Strengths: ${parsed.keyStrengths.join(', ')}.`
        : '';
      return `${parsed.summary} Alignment: ${parsed.collaborationAlignment}.${strengthsText}`;
    };

    if (!apiKey) {
      summaryText = this.getFallbackSummary(contact);
    } else {
      try {
        summaryText = await retryWithBackoff(() => 
          withTimeout(executeLlmGeneration(), 10000, 'AI summary generation timed out after 10 seconds')
        );
      } catch (err) {
        console.warn('[AI Summary] Gemini API error, falling back to local heuristic parser:', err);
        summaryText = this.getFallbackSummary(contact);
      }
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

  private getFallbackSummary(contact: any): string {
    const skillsList = contact.skills.length > 0 ? contact.skills.join(', ') : 'various fields';
    const companyText = contact.company ? `working with ${contact.company}` : 'independent professional';
    const designationText = contact.designation || 'Expert';
    return `[AI Summary] ${contact.name} is a ${designationText} ${companyText}. Their key competency domains span across ${skillsList}. Recorded via ${contact.source}. Recommendations: Highly suitable contact for potential executive collaboration (Decision Maker Score: ${contact.decisionMakerScore}/100).`;
  }
}
