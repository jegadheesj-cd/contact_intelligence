import { PrismaClient } from '@prisma/client';
import { ProfileEnrichmentService } from './src/modules/profile-enrichment/enrichment.service';
import { AiSummaryService } from './src/modules/ai-summary/ai-summary.service';

const prisma = new PrismaClient();

const testCards = [
  {
    name: 'Alice Johnson',
    company: 'Future Ventures',
    designation: 'Managing Partner',
    email: 'alice@futureventures.com',
    website: 'https://futureventures.com',
    address: 'Silicon Valley, CA'
  },
  {
    name: 'Jegadhees Jambulingam',
    company: 'Google DeepMind',
    designation: 'Staff AI Engineer',
    email: 'jegadhees@deepmind.com',
    website: 'https://deepmind.google',
    address: 'London, UK'
  },
  {
    name: 'Satya Nadella',
    company: 'Microsoft',
    designation: 'CEO',
    email: 'satya@microsoft.com',
    website: 'https://microsoft.com',
    address: 'Redmond, WA'
  }
];

async function run() {
  console.log('========================================================================');
  console.log('STARTING PIPELINE TEST FOR 3 COMPLETELY DIFFERENT BUSINESS CARDS');
  console.log('========================================================================\n');

  const enrichmentService = new ProfileEnrichmentService();
  const aiSummaryService = new AiSummaryService();

  for (let i = 0; i < testCards.length; i++) {
    const card = testCards[i];
    console.log(`------------------------------------------------------------------------`);
    console.log(`BUSINESS CARD ${String.fromCharCode(65 + i)}: ${card.name} (${card.company})`);
    console.log(`------------------------------------------------------------------------`);
    console.log(`OCR Output (Target Contact):`);
    console.log(JSON.stringify(card, null, 2));
    console.log();

    console.log(`[Enrichment Pipeline] STAGE START: Profile Discovery`);
    const pipelineResult = await enrichmentService.runDiscoveryPipeline(card);
    console.log(`[Enrichment Pipeline] STAGE SUCCESS: Profile Discovery`);
    console.log();

    console.log(`[Enrichment Pipeline] STAGE START: Verification`);
    console.log(`Verification Confidence: ${pipelineResult.verification.confidence}%`);
    console.log(`Verification Status: ${pipelineResult.verification.isVerified ? 'Verified' : 'Rejected'}`);
    console.log(`Verification Reason:`, pipelineResult.verification.reasons);
    console.log();

    console.log(`[Enrichment Pipeline] STAGE START: Profile Merge`);
    console.log(`Merged Profile JSON:`);
    console.log(JSON.stringify(pipelineResult.mergedProfile, null, 2));
    console.log();

    if (pipelineResult.mergedProfile) {
      console.log(`[Enrichment Pipeline] STAGE START: AI Insights Generation (Gemini)`);
      
      const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
      if (apiKey) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `You are a strict Professional Analyst.
Your task is to analyze the following VERIFIED profile data and extract key insights.
You must NEVER invent, guess, or hallucinate information. If the information is not present in the input, omit it.

INPUT DATA:
Name: ${card.name}
Company: ${card.company}
Designation: ${card.designation}
Verified Profile Data (JSON):
${JSON.stringify(pipelineResult.mergedProfile)}

Output ONLY a valid JSON object matching this exact format:
{
  "executiveSummary": "A concise professional background summary (2-3 sentences).",
  "professionalHighlights": ["Highlight 1", "Highlight 2"],
  "careerSummary": "A brief overview summarizing their career progression and history.",
  "decisionMakerExplanation": "Explanation of why they are or are not a decision maker based on designation/role.",
  "conversationStarters": ["Starter Idea 1", "Starter Idea 2"],
  "networkingSuggestions": "Suggestions on how to build a professional relationship with them.",
  "professionalStrengths": ["Strength 1", "Strength 2"]
}
Do not include markdown blocks or any conversational text.`;

        console.log(`Gemini Input Prompt:\n${prompt}\n`);
        
        try {
          const response = await model.generateContent(prompt);
          const text = response.response.text().trim();
          const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
          console.log(`Gemini Output Response:`);
          console.log(JSON.stringify(JSON.parse(cleaned), null, 2));
        } catch (err: any) {
          console.log(`Gemini Output Response: FAILED (Rate limits/limit zero)`);
          console.log(err.message);
        }
      }
    }
    console.log('\n');
  }
}

run().catch(e => console.error(e)).finally(() => prisma.$disconnect());
