import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../config/logger';

/**
 * Helper to fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Generates text using Groq API as primary, falling back to Gemini API.
 */
export async function generateTextWithFallback(
  prompt: string,
  geminiModelName: string,
  contextName: string
): Promise<string> {
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (!groqApiKey && !geminiApiKey) {
    throw new Error(`[AI Client - ${contextName}] Both GROQ_API_KEY and GEMINI_API_KEY/OPENAI_API_KEY are missing from the environment.`);
  }

  // 1. Try Groq first if key exists
  if (groqApiKey) {
    try {
      logger.info(`[AI Client - ${contextName}] Attempting generation via Groq API (llama-3.3-70b-versatile)...`);
      const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
        }),
      }, 15000);

      if (response.ok) {
        const data = (await response.json()) as any;
        const content = data.choices?.[0]?.message?.content || '';
        if (content.trim()) {
          logger.info(`[AI Client - ${contextName}] Groq API generation successful.`);
          return content.trim();
        }
      }
      
      const errText = await response.text();
      logger.warn(`[AI Client - ${contextName}] Groq API request failed (status ${response.status}): ${errText}`);
    } catch (err: any) {
      logger.warn(`[AI Client - ${contextName}] Error calling Groq API: ${err.message || err}`);
    }
  }

  // 2. Fallback to Gemini
  if (geminiApiKey) {
    logger.info(`[AI Client - ${contextName}] Falling back/attempting generation via Gemini API (${geminiModelName})...`);
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: geminiModelName });
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      logger.info(`[AI Client - ${contextName}] Gemini API generation successful.`);
      return text.trim();
    } catch (err: any) {
      logger.error(`[AI Client - ${contextName}] Gemini API request failed: ${err.message || err}`);
      throw err;
    }
  }

  throw new Error(`[AI Client - ${contextName}] Failed to generate content: Groq failed and Gemini is not configured.`);
}
