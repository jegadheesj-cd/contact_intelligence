import { Worker, Job } from 'bullmq';
import { connectionOptions, enrichmentQueue, aiSummaryQueue } from '../queue/queue';
import prisma from '../config/db';
import logger from '../config/logger';
import { JobStatus, ContactSource, Prisma } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ProfileEnrichmentService, calculateDecisionMakerScore } from '../modules/profile-enrichment/enrichment.service';
import { AiSummaryService } from '../modules/ai-summary/ai-summary.service';
import { FaceRecognitionService } from '../modules/face-recognition/face.service';
import { parseContactString } from '../utils/vcardParser';
import { validateAndCorrectContact, runGeminiOcrClassifier } from '../utils/validationEngine';
import { ContactsService } from '../modules/contacts/contacts.service';
import { FaceSearchProviderManager } from '../modules/face-recognition/providers/FaceSearchProviderManager';
import { CandidateVerificationService } from '../modules/face-recognition/services/CandidateVerificationService';
import { generateTextWithFallback } from '../utils/aiClient';

const execFilePromise = promisify(execFile);
const enrichmentService = new ProfileEnrichmentService();
const aiSummaryService = new AiSummaryService();
const faceService = new FaceRecognitionService();
const contactsService = new ContactsService();
const faceSearchManager = new FaceSearchProviderManager(); // Trigger reload: SerpApi provider active with cache bypass
const candidateVerificationService = new CandidateVerificationService();

// 1. OCR Processing Worker
export const ocrWorker = new Worker(
  'ocr-queue',
  async (job: Job) => {
    const { businessCardId } = job.data;
    logger.info(`[OCR Job] Started processing business card: ${businessCardId}`);
    const startTime = Date.now();

    try {
      // Fetch BusinessCard details along with file path
      const businessCard = await prisma.businessCard.findUnique({
        where: { id: businessCardId },
        include: { uploadedFile: true },
      });

      if (!businessCard || !businessCard.uploadedFile) {
        throw new Error(`Business card or uploaded file record not found for ID: ${businessCardId}`);
      }

      // Set status to PROCESSING
      await prisma.businessCard.update({
        where: { id: businessCardId },
        data: { ocrStatus: JobStatus.PROCESSING },
      });

      // Execute Python OCR Script
      const scriptPath = path.resolve(__dirname, '../scripts/ocr_processor.py');
      const cardImagePath = path.resolve(businessCard.uploadedFile.path);

      const { stdout } = await execFilePromise('python', [scriptPath, cardImagePath]);
      const jsonStart = stdout.indexOf('{');
      if (jsonStart === -1) throw new Error("JSON payload not found in OCR python output");
      const result = JSON.parse(stdout.substring(jsonStart));

      if (!result.success) {
        throw new Error(result.message || 'OCR processing script failed.');
      }

      // Merge QR data and OCR data, prioritizing QR Data (Task 2)
      const ocrFields = result.structured || {};
      let qrFields: any = {};

      if (result.qr_present && result.qr_data && result.qr_data.length > 0) {
        const qrPayload = result.qr_data[0];
        qrFields = parseContactString(qrPayload);
      }

      const mergedFields = {
        name: qrFields.name || ocrFields.name || 'Unknown Contact',
        company: qrFields.company || ocrFields.company || null,
        designation: qrFields.designation || ocrFields.designation || null,
        email: qrFields.email || ocrFields.email || null,
        phone: qrFields.phone || ocrFields.phone || null,
        website: qrFields.website || ocrFields.website || null,
        address: qrFields.address || ocrFields.address || null,
        linkedin_url: qrFields.linkedin_url || ocrFields.linkedin_url || null,
      };

      // Call validation engine
      const validation = await runGeminiOcrClassifier(result.ocr_text, mergedFields);
      const validatedFields = validation.fields;

      // Complete OCR and save data
      const updatedCard = await prisma.businessCard.update({
        where: { id: businessCardId },
        data: {
          ocrStatus: JobStatus.COMPLETED,
          extractedData: {
            rawOcrText: result.ocr_text,
            qrPresent: result.qr_present,
            qrData: result.qr_data,
            fields: validatedFields as any,
            understanding: validation.understanding as any,
            needsManualReview: validation.needsManualReview,
          },
        },
      });

      const userId = businessCard.uploadedFile.userId;
      let activeContactId: string;

      // If contactId is associated, update details. Otherwise, create or merge into a contact profile!
      if (updatedCard.contactId) {
        activeContactId = updatedCard.contactId;
        await contactsService.mergeFieldsIntoContact(userId, activeContactId, validatedFields);

        // Write audit log / timeline
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'OCR_PROCESSING_COMPLETED',
            entity: 'Contact',
            entityId: activeContactId,
            details: {
              processingTimeMs: Date.now() - startTime,
              qrCodeUsed: result.qr_present,
            },
          },
        }).catch(() => {});
      } else {
        // Check for duplicates
        const duplicate = await contactsService.findDuplicateContact(userId, validatedFields);
        if (duplicate) {
          logger.info(`[OCR Job] Found duplicate contact ${duplicate.id} for card ${businessCardId}. Merging...`);
          activeContactId = duplicate.id;
          await contactsService.mergeFieldsIntoContact(userId, activeContactId, validatedFields);

          // Update card and uploaded file to link to this duplicate contact
          await prisma.businessCard.update({
            where: { id: businessCardId },
            data: { contactId: activeContactId },
          });

          await prisma.uploadedFile.update({
            where: { id: businessCard.uploadedFileId },
            data: { contactId: activeContactId },
          });

          // Write audit log / timeline
          await prisma.auditLog.create({
            data: {
              userId,
              action: 'CONTACT_MERGED_FROM_OCR',
              entity: 'Contact',
              entityId: activeContactId,
              details: {
                processingTimeMs: Date.now() - startTime,
                qrCodeUsed: result.qr_present,
                duplicateMatched: true,
              },
            },
          }).catch(() => {});
        } else {
          // Create new contact profile
          const ocrScore = calculateDecisionMakerScore(validatedFields.designation || '');
          const newContact = await prisma.contact.create({
            data: {
              userId,
              name: validatedFields.name || 'Unknown Contact',
              company: validatedFields.company,
              designation: validatedFields.designation,
              email: validatedFields.email,
              phone: validatedFields.phone,
              website: validatedFields.website,
              address: validatedFields.address,
              source: result.qr_present ? ContactSource.QR : ContactSource.BUSINESS_CARD,
              decisionMakerScore: ocrScore,
            },
          });

          activeContactId = newContact.id;

          // Update card and uploaded file to link to this new contact
          await prisma.businessCard.update({
            where: { id: businessCardId },
            data: { contactId: activeContactId },
          });

          await prisma.uploadedFile.update({
            where: { id: businessCard.uploadedFileId },
            data: { contactId: activeContactId },
          });

          // Write audit log / timeline
          await prisma.auditLog.create({
            data: {
              userId,
              action: 'CONTACT_CREATED_FROM_OCR',
              entity: 'Contact',
              entityId: activeContactId,
              details: {
                processingTimeMs: Date.now() - startTime,
                qrCodeUsed: result.qr_present,
              },
            },
          }).catch(() => {});
        }
      }

      // If low confidence, apply needs-manual-review tag
      if (validation.needsManualReview) {
        logger.info(`[OCR Job] Tagging contact ${activeContactId} as needs-manual-review`);
        await contactsService.addTags(userId, activeContactId, ['needs-manual-review']).catch(() => {});
      }

      // Automatically trigger professional profile enrichment
      if (activeContactId) {
        logger.info(`[OCR Job] Auto-triggering professional profile enrichment for contact: ${activeContactId}`);
        const enrichmentService = new ProfileEnrichmentService();
        await enrichmentService.triggerEnrichment(userId, activeContactId).catch((err) => {
          logger.error(`[OCR Job] Failed to auto-trigger enrichment: ${err.message}`);
        });
      }

      logger.info(`[OCR Job] Successfully completed business card: ${businessCardId} in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      logger.error(`[OCR Job] Error on business card ${businessCardId}: ${error.message}`);
      await prisma.businessCard.update({
        where: { id: businessCardId },
        data: { ocrStatus: JobStatus.FAILED },
      }).catch(() => {});
      throw error;
    }
  },
  { connection: connectionOptions }
);

// 2. Profile Enrichment Worker
export const enrichmentWorker = new Worker(
  'enrichment-queue',
  async (job: Job) => {
    const { contactId, profileId } = job.data;
    const pipelineStartTime = Date.now();
    logger.info(`[Enrichment Pipeline] START - Enrichment process initiated for profile: ${profileId}`);

    const updateStatus = async (status: any) => {
      await prisma.professionalProfile.update({
        where: { id: profileId },
        data: { enrichmentStatus: status },
      });
    };

    try {
      await updateStatus(JobStatus.PROCESSING);

      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      if (!contact) {
        throw new Error(`Contact not found for ID: ${contactId}`);
      }

      // STAGE 1: Profile Discovery & Extraction
      const discoveryStartTime = Date.now();
      logger.info(`[Enrichment Pipeline] STAGE START: Profile Discovery`);
      
      await updateStatus(JobStatus.FETCHING_PROFILE);
      const pipelineResult = await enrichmentService.runDiscoveryPipeline(contact);
      
      const discoveryDuration = Date.now() - discoveryStartTime;
      logger.info(`[Enrichment Pipeline] STAGE SUCCESS: Profile Discovery completed in ${discoveryDuration}ms`);

      // STAGE 2: Verification
      const verificationStartTime = Date.now();
      logger.info(`[Enrichment Pipeline] STAGE START: Verification`);
      
      await updateStatus(JobStatus.VERIFYING);
      
      const isVerified = pipelineResult?.verification?.isVerified || false;
      const confidence = pipelineResult?.verification?.confidence || 0;
      const verificationStatus = isVerified ? 'Verified' : 'No verified professional profile found';
      
      await prisma.professionalProfile.update({
        where: { id: profileId },
        data: {
          verificationConfidence: confidence,
          verificationStatus: verificationStatus,
          providersUsed: pipelineResult?.providersUsed || [],
          providerResponses: pipelineResult?.providerResponses || null,
          mergedProfile: pipelineResult?.mergedProfile || null,
          sourceAttribution: pipelineResult?.sourceAttribution || null,
        }
      });

      const verificationDuration = Date.now() - verificationStartTime;
      logger.info(`[Enrichment Pipeline] STAGE SUCCESS: Verification computed confidence as ${confidence}% (${verificationStatus}) in ${verificationDuration}ms`);

      // STAGE 3: Database Save (separating OCR from enriched details)
      const dbSaveStartTime = Date.now();
      logger.info(`[Enrichment Pipeline] STAGE START: Database Save (Merging Data)`);
      
      const designationValue = pipelineResult?.mergedProfile?.designation?.value || contact.designation || '';
      const enrichedScore = calculateDecisionMakerScore(designationValue);
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          skills: pipelineResult?.mergedProfile?.skills?.value || [],
          industry: pipelineResult?.mergedProfile?.headline?.value || 'Professional Services',
          experience: pipelineResult?.mergedProfile?.experience?.value || null,
          education: pipelineResult?.mergedProfile?.education?.value || null,
          decisionMakerScore: enrichedScore,
        },
      });

      const dbSaveDuration = Date.now() - dbSaveStartTime;
      logger.info(`[Enrichment Pipeline] STAGE SUCCESS: Merged data saved successfully to database in ${dbSaveDuration}ms`);

      // STAGE 4: AI Insights generation (optional — Gemini failure does NOT block pipeline)
      const summaryStartTime = Date.now();
      logger.info(`[Enrichment Pipeline] STAGE START: AI Insights Generation (Gemini) [optional]`);
      await updateStatus(JobStatus.GENERATING_SUMMARY);
      try {
        await aiSummaryService.generateSummary(contact.userId, contactId);
        const summaryDuration = Date.now() - summaryStartTime;
        logger.info(`[Enrichment Pipeline] STAGE SUCCESS: AI Insights generated in ${summaryDuration}ms`);
      } catch (summaryErr: any) {
        logger.warn(`[Enrichment Pipeline] STAGE SKIPPED: AI Insights generation failed (non-blocking): ${summaryErr.message}`);
        // Save a fallback summary record so the UI has something to display
        await prisma.aISummary.upsert({
          where: { contactId },
          create: { contactId, summaryText: JSON.stringify({ executiveSummary: '', professionalHighlights: [], careerSummary: '', decisionMakerExplanation: '', conversationStarters: [], networkingSuggestions: '', professionalStrengths: [] }), status: 'COMPLETED' as any },
          update: { summaryText: JSON.stringify({ executiveSummary: '', professionalHighlights: [], careerSummary: '', decisionMakerExplanation: '', conversationStarters: [], networkingSuggestions: '', professionalStrengths: [] }), status: 'COMPLETED' as any },
        }).catch(() => {});
      }

      // STATE: COMPLETED — always reached unless Discovery itself throws
      await updateStatus(JobStatus.COMPLETED);

      await prisma.auditLog.create({
        data: {
          userId: contact.userId,
          action: 'PROFILE_PIPELINE_COMPLETED',
          entity: 'Contact',
          entityId: contactId,
          details: { processingTimeMs: Date.now() - pipelineStartTime, verified: isVerified },
        },
      }).catch(() => {});

      const totalDuration = Date.now() - pipelineStartTime;
      logger.info(`[Enrichment Pipeline] SUCCESS - Pipeline completed for profile: ${profileId} in ${totalDuration}ms`);
    } catch (error: any) {
      const failedDuration = Date.now() - pipelineStartTime;
      logger.error(`[Enrichment Pipeline] FAILED - Pipeline crashed after ${failedDuration}ms. Reason: ${error.message}`);
      logger.error(error.stack || error);
      
      const updateData: any = { enrichmentStatus: JobStatus.FAILED };
      if (error.name === 'ProviderError') {
        updateData.verificationStatus = error.message;
        updateData.providerResponses = [{
          success: false,
          provider: error.provider || 'Tavily',
          status: error.status || 'PROVIDER_UNAVAILABLE',
          message: error.message
        }];
      }
      
      await prisma.professionalProfile.update({
        where: { id: profileId },
        data: updateData,
      }).catch((dbErr) => logger.error(`[Enrichment Pipeline] Failed to update status: ${dbErr.message}`));
      
      throw error;
    }

  },
  { connection: connectionOptions }
);

// 3. AI Summary Generation Worker
export const aiSummaryWorker = new Worker(
  'ai-summary-queue',
  async (job: Job) => {
    const { contactId, aiSummaryId } = job.data;
    logger.info(`[AI Summary Job] Started generating summary for contact: ${contactId}`);
    const startTime = Date.now();

    try {
      await prisma.aISummary.update({
        where: { id: aiSummaryId },
        data: { status: JobStatus.PROCESSING },
      });

      // Call service layer (handles real LLM generation)
      const summary = await aiSummaryService.generateSummary(job.data.userId || '', contactId);

      // Write timeline audit log
      const contact = await prisma.contact.findUnique({ where: { id: contactId } });
      if (contact) {
        await prisma.auditLog.create({
          data: {
            userId: contact.userId,
            action: 'AI_SUMMARY_GENERATED',
            entity: 'Contact',
            entityId: contactId,
            details: { processingTimeMs: Date.now() - startTime },
          },
        }).catch(() => {});
      }

      logger.info(`[AI Summary Job] Successfully completed AI summary for contact: ${contactId} in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      logger.error(`[AI Summary Job] Error on AI summary ${aiSummaryId}:`);
      logger.error(error.stack || error.message);
      await prisma.aISummary.update({
        where: { id: aiSummaryId },
        data: { status: JobStatus.FAILED },
      }).catch((dbErr) => logger.error(`[AI Summary Job] Failed to update status: ${dbErr.message}`));
      throw error;
    }
  },
  { connection: connectionOptions }
);

// 4. Face Recognition Worker (OSINT Pipeline)
export const faceRecognitionWorker = new Worker(
  'face-recognition-queue',
  async (job: Job) => {
    const { faceRecognitionId } = job.data;
    logger.info(`[Face OSINT Pipeline] Started processing: ${faceRecognitionId}`);
    const startTime = Date.now();
    let providerUsed = 'None';
    let candidateCount = 0;
    let confidenceScore = 0.0;
    let finalStatus = 'NO_MATCH';
    let userId = '';
    let uploadedImagePath = '';

    try {
      const faceRecognition = await prisma.faceRecognition.findUnique({
        where: { id: faceRecognitionId },
        include: { uploadedFile: true },
      });

      if (!faceRecognition || !faceRecognition.uploadedFile) {
        throw new Error(`Face recognition or file upload not found for ID: ${faceRecognitionId}`);
      }

      await job.updateProgress(10);
      userId = faceRecognition.uploadedFile.userId;
      uploadedImagePath = faceRecognition.uploadedFile.path;

      await prisma.faceRecognition.update({
        where: { id: faceRecognitionId },
        data: { status: JobStatus.PROCESSING },
      });

      // 1. Face Quality Validation & Embedding Generation (using existing script)
      const isVideo = faceRecognition.uploadedFile.mimeType.startsWith('video/');
      logger.info(`[Face OSINT Pipeline] STAGE: Extracting face embeddings`);
      
      const matchResult = await faceService.matchFaceAgainstEnrolled(
        userId,
        uploadedImagePath,
        isVideo
      );

      // Even if local match is found, we proceed to OSINT to discover public profiles.
      await job.updateProgress(30);

      // 2. Reverse Face Search
      logger.info(`[Face OSINT Pipeline] STAGE: Reverse Face Search via Providers`);
      const searchResponse = await faceSearchManager.search(uploadedImagePath);
      await job.updateProgress(60);
      providerUsed = searchResponse.provider;
      candidateCount = searchResponse.candidates.length;

      let contactId = matchResult.matched ? matchResult.contactId : null;

      if (searchResponse.success && searchResponse.candidates.length > 0) {
        // 3. Candidate Verification
        logger.info(`[Face OSINT Pipeline] STAGE: Candidate Verification`);
        const verifiedCandidates = candidateVerificationService.verifyCandidates(searchResponse.candidates, matchResult.similarityScore || 0);
        await job.updateProgress(75);
        
        if (verifiedCandidates.length > 0) {
          finalStatus = 'SUCCESS';
          confidenceScore = verifiedCandidates[0].confidence;
          const bestCandidate = verifiedCandidates[0]; // Take highest confidence

          // 4. Create/Update Contact with initial candidate data
          if (!contactId) {
            let cleanName = bestCandidate.title || 'Unknown Face Match';
            try {
              const prompt = `Extract only the clean, full name of the person from this search result title. Do not include titles (like CEO, Founder), company names, video platforms (like YouTube), or descriptions. Return ONLY the name (e.g., Mark Zuckerberg).
Title: "${cleanName}"
Name:`;
              const aiResponse = await generateTextWithFallback(prompt, 'gemini-1.5-pro', 'Name Cleaning');
              if (aiResponse && aiResponse.trim().length > 0) {
                cleanName = aiResponse.trim().replace(/^['"\s]+|['"\s]+$/g, '');
              }
            } catch (e: any) {
              logger.warn(`Failed to clean name using AI: ${e.message}`);
            }

            const newContact = await prisma.contact.create({
              data: {
                userId,
                name: cleanName,
                website: bestCandidate.url,
                source: ContactSource.FACE_RECOGNITION,
              }
            });
            contactId = newContact.id;
          } else {
             // Merge new link into existing contact
             await prisma.contact.update({
               where: { id: contactId },
               data: { website: bestCandidate.url }
             });
          }

          // 5. Trigger ProfileDiscoveryEngine to enrich this verified URL
          logger.info(`[Face OSINT Pipeline] STAGE: Profile Enrichment Triggered for ${contactId}`);
          await enrichmentService.triggerEnrichment(userId, contactId).catch(err => {
             logger.warn(`Failed to trigger Profile Enrichment: ${err.message}`);
          });
        }
      } else if (matchResult.matched) {
         // Local match only
         finalStatus = 'SUCCESS_LOCAL_ONLY';
         confidenceScore = matchResult.similarityScore;
      }

      // 6. Save match results and Search History via Transaction
      const processingTime = Date.now() - startTime;
      await job.updateProgress(90);
      
      await prisma.$transaction([
        prisma.faceRecognition.update({
          where: { id: faceRecognitionId },
          data: {
            status: JobStatus.COMPLETED,
            recognizedResult: {
               localMatch: matchResult,
               osintMatch: searchResponse
            } as unknown as Prisma.InputJsonValue,
            contactId: contactId,
          },
        }),
        prisma.faceSearchHistory.create({
          data: {
             uploadedImage: uploadedImagePath,
             userId: userId,
             providerUsed: providerUsed,
             candidateCount: candidateCount,
             processingTime: processingTime,
             status: finalStatus,
             confidence: confidenceScore,
          }
        })
      ]);

      await job.updateProgress(100);
      logger.info(`[Face OSINT Pipeline] Completed processing: ${faceRecognitionId} in ${processingTime}ms`);
    } catch (error: any) {
      logger.error(`[Face OSINT Pipeline] Error on ${faceRecognitionId}:`);
      logger.error(error.stack || error.message);
      
      await prisma.faceRecognition.update({
        where: { id: faceRecognitionId },
        data: { status: JobStatus.FAILED },
      }).catch((dbErr) => logger.error(`[Face OSINT] Failed to update status: ${dbErr.message}`));
      
      if (userId && uploadedImagePath) {
         await prisma.faceSearchHistory.create({
           data: {
              uploadedImage: uploadedImagePath,
              userId: userId,
              providerUsed: providerUsed,
              candidateCount: 0,
              processingTime: Date.now() - startTime,
              status: 'FAILED',
              confidence: 0.0,
           }
         }).catch(() => {});
      }
      throw error;
    }
  },
  { connection: connectionOptions, concurrency: 5, lockDuration: 60000 }
);

// Error and failure event listeners for BullMQ Workers
ocrWorker.on('failed', (job, err) => {
  logger.error(`[BullMQ OCR Worker] Job ${job?.id} failed: ${err.message}`);
});
ocrWorker.on('error', (err) => {
  logger.error(`[BullMQ OCR Worker] Connection error: ${err.message}`);
});

enrichmentWorker.on('failed', (job, err) => {
  logger.error(`[BullMQ Enrichment Worker] Job ${job?.id} failed: ${err.message}`);
});
enrichmentWorker.on('error', (err) => {
  logger.error(`[BullMQ Enrichment Worker] Connection error: ${err.message}`);
});

aiSummaryWorker.on('failed', (job, err) => {
  logger.error(`[BullMQ AI Summary Worker] Job ${job?.id} failed: ${err.message}`);
});
aiSummaryWorker.on('error', (err) => {
  logger.error(`[BullMQ AI Summary Worker] Connection error: ${err.message}`);
});

faceRecognitionWorker.on('failed', (job, err) => {
  logger.error(`[BullMQ Face Recognition Worker] Job ${job?.id} failed: ${err.message}`);
});
faceRecognitionWorker.on('error', (err) => {
  logger.error(`[BullMQ Face Recognition Worker] Connection error: ${err.message}`);
});

// Graceful shutdown helper
export const shutdownWorkers = async () => {
  logger.info('Shutting down BullMQ workers...');
  await Promise.all([
    ocrWorker.close(),
    enrichmentWorker.close(),
    aiSummaryWorker.close(),
    faceRecognitionWorker.close(),
  ]);
  logger.info('BullMQ workers closed.');
};

