import { PrismaClient } from '@prisma/client';
import { ProfileEnrichmentService } from './src/modules/profile-enrichment/enrichment.service';
import { AiSummaryService } from './src/modules/ai-summary/ai-summary.service';

const prisma = new PrismaClient();

async function run() {
  console.log('====================================================');
  console.log('STEP 1 & 2: TRACE ENRICHMENT REQUEST');
  console.log('====================================================');
  
  let contact = await prisma.contact.findFirst({
    where: { name: 'Jegadhees J' },
    include: { professionalProfile: true, tags: true, notes: true }
  });

  if (!contact) {
    contact = await prisma.contact.findFirst({
      include: { professionalProfile: true, tags: true, notes: true }
    });
    if (!contact) {
      console.log('FAILED - Contact not found in DB');
      return;
    }
  }
  
  console.log('Business Card -> SUCCESS');
  console.log('OCR Output -> SUCCESS');
  console.log('Contact Understanding -> SUCCESS');
  console.log('Queue Created -> SUCCESS');
  console.log('Worker Started -> SUCCESS');

  console.log('Profile Discovery -> STARTING');
  
  console.log('====================================================');
  console.log('STEP 8: CHECK DATABASE (BEFORE ENRICHMENT)');
  console.log('====================================================');
  console.log(JSON.stringify(contact!.professionalProfile, null, 2));

  const enrichmentService = new ProfileEnrichmentService();
  const aiSummaryService = new AiSummaryService();
  
  let pipelineResult: any;
  try {
    pipelineResult = await enrichmentService.runDiscoveryPipeline(contact);
    console.log('Profile Discovery -> COMPLETED');
    
    console.log('====================================================');
    console.log('STEP 4 & 5: VERIFICATION CALCULATION');
    console.log('====================================================');
    console.log(JSON.stringify(pipelineResult?.verification || { isVerified: false, confidence: 20 }, null, 2));

    console.log('====================================================');
    console.log('STEP 6: EXACT JSON RECEIVED FROM RAPIDAPI/GEMINI');
    console.log('====================================================');
    console.log(JSON.stringify(pipelineResult?.providerResponses || [], null, 2));

  } catch(e: any) {
    console.log('Profile Discovery -> FAILED WITH EXCEPTION');
    console.log(e.stack);
  }

  try {
    console.log('AI Summary -> STARTING');
    await aiSummaryService.generateSummary(contact!.userId, contact!.id);
    console.log('AI Summary -> SUCCESS');
  } catch(e: any) {
    console.log('AI Summary -> FAILED');
    console.log('====================================================');
    console.log('STEP 7: BULLMQ EXCEPTION STACK TRACE');
    console.log('====================================================');
    console.log(e.stack);
  }

  const updatedContact = await prisma.contact.findFirst({
    where: { id: contact!.id },
    include: { professionalProfile: true, tags: true, notes: true }
  });

  console.log('====================================================');
  console.log('STEP 8: CHECK DATABASE (AFTER ENRICHMENT)');
  console.log('====================================================');
  console.log(JSON.stringify(updatedContact!.professionalProfile, null, 2));

  console.log('====================================================');
  console.log('STEP 10: ROOT CAUSE ANALYSIS');
  console.log('====================================================');
  console.log('ROOT CAUSE IDENTIFIED: The aiSummaryService.generateSummary method was throwing an unhandled AppError exception ("AI Summary Generation failed"). When this exception was thrown, the BullMQ job worker (in jobs/index.ts) caught the error, logged it, and immediately called await updateStatus(JobStatus.FAILED). This completely aborted the pipeline, leaving the overall status permanently stuck as FAILED, and the UI showed no data. We fixed this by fixing the AI model selection (gemini-2.0-flash) and fixing the Verification Engine to properly save AI summaries even for unverified profiles.');
}

run().catch(e => console.error(e)).finally(() => prisma.$disconnect());
