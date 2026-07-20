import { Worker, Job } from 'bullmq';
import { connectionOptions, enrichmentQueue, aiSummaryQueue } from '../queue/queue';
import prisma from '../config/db';
import logger from '../config/logger';
import { JobStatus, ContactSource } from '@prisma/client';
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

const execFilePromise = promisify(execFile);
const enrichmentService = new ProfileEnrichmentService();
const aiSummaryService = new AiSummaryService();
const faceService = new FaceRecognitionService();
const contactsService = new ContactsService();

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
    logger.info(`[Enrichment Job] Started enrichment for profile: ${profileId}`);
    const startTime = Date.now();

    try {
      await prisma.linkedInProfile.update({
        where: { id: profileId },
        data: { enrichmentStatus: JobStatus.PROCESSING },
      });

      // Fetch contact details
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      if (!contact) {
        throw new Error(`Contact not found for ID: ${contactId}`);
      }

      // Run real enrichment using Gemini with Search grounding
      const enrichmentData = await enrichmentService.instantEnrich(
        contact.name,
        contact.email,
        contact.company
      );

      // Save enrichment results to LinkedInProfile
      await prisma.linkedInProfile.update({
        where: { id: profileId },
        data: {
          enrichmentStatus: JobStatus.COMPLETED,
          salesNavigatorId: enrichmentData.salesNavigatorId || null,
          linkedInUrl: enrichmentData.publicProfiles?.find((p: any) => p.platform === 'LinkedIn')?.url || null,
          profileData: enrichmentData,
        },
      });

      const enrichedScore = calculateDecisionMakerScore(contact.designation || enrichmentData.designation || '');

      // Update contact fields
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          skills: enrichmentData.skills || [],
          industry: enrichmentData.industry || 'Professional Services',
          experience: enrichmentData.experience || null,
          education: enrichmentData.education || null,
          interests: enrichmentData.interests || [],
          decisionMakerScore: enrichedScore,
        },
      });

      // Write timeline audit log
      await prisma.auditLog.create({
        data: {
          userId: contact.userId,
          action: 'PROFILE_ENRICHED',
          entity: 'Contact',
          entityId: contactId,
          details: { processingTimeMs: Date.now() - startTime },
        },
      }).catch(() => {});

      logger.info(`[Enrichment Job] Successfully enriched profile: ${profileId} in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      logger.error(`[Enrichment Job] Error on profile ${profileId}: ${error.message}`);
      await prisma.linkedInProfile.update({
        where: { id: profileId },
        data: { enrichmentStatus: JobStatus.FAILED },
      }).catch(() => {});
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
      logger.error(`[AI Summary Job] Error on AI summary ${aiSummaryId}: ${error.message}`);
      await prisma.aISummary.update({
        where: { id: aiSummaryId },
        data: { status: JobStatus.FAILED },
      }).catch(() => {});
      throw error;
    }
  },
  { connection: connectionOptions }
);

// 4. Face Recognition Worker
export const faceRecognitionWorker = new Worker(
  'face-recognition-queue',
  async (job: Job) => {
    const { faceRecognitionId } = job.data;
    logger.info(`[Face Job] Started face recognition processing: ${faceRecognitionId}`);
    const startTime = Date.now();

    try {
      const faceRecognition = await prisma.faceRecognition.findUnique({
        where: { id: faceRecognitionId },
        include: { uploadedFile: true },
      });

      if (!faceRecognition || !faceRecognition.uploadedFile) {
        throw new Error(`Face recognition or file upload not found for ID: ${faceRecognitionId}`);
      }

      await prisma.faceRecognition.update({
        where: { id: faceRecognitionId },
        data: { status: JobStatus.PROCESSING },
      });

      const isVideo = faceRecognition.uploadedFile.mimeType.startsWith('video/');

      // Match face against database-enrolled faces
      const matchResult = await faceService.matchFaceAgainstEnrolled(
        faceRecognition.uploadedFile.userId,
        faceRecognition.uploadedFile.path,
        isVideo
      );

      // Save match results to DB
      await prisma.faceRecognition.update({
        where: { id: faceRecognitionId },
        data: {
          status: JobStatus.COMPLETED,
          recognizedResult: matchResult,
          contactId: matchResult.matched ? matchResult.contactId : null,
        },
      });

      // Update contact source if matched
      if (matchResult.matched) {
        await prisma.contact.update({
          where: { id: matchResult.contactId },
          data: { source: ContactSource.FACE_RECOGNITION },
        });

        // Write timeline audit log
        await prisma.auditLog.create({
          data: {
            userId: faceRecognition.uploadedFile.userId,
            action: 'FACE_RECOGNITION_MATCHED',
            entity: 'Contact',
            entityId: matchResult.contactId,
            details: {
              similarityScore: matchResult.similarityScore,
              processingTimeMs: Date.now() - startTime,
            },
          },
        }).catch(() => {});
      }

      logger.info(`[Face Job] Completed face recognition processing: ${faceRecognitionId} in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      logger.error(`[Face Job] Error on face recognition ${faceRecognitionId}: ${error.message}`);
      await prisma.faceRecognition.update({
        where: { id: faceRecognitionId },
        data: { status: JobStatus.FAILED },
      }).catch(() => {});
      throw error;
    }
  },
  { connection: connectionOptions }
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

