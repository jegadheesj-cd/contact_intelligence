import { enrichmentQueue } from '../../queue/queue';
import prisma from '../../config/db';
import { AppError } from '../../utils/AppError';
import logger from '../../config/logger';

import { ProfileDiscoveryEngine, CandidateProfile } from './services/ProfileDiscoveryEngine';
import { ProfileVerificationEngine } from './services/ProfileVerificationEngine';
import { ProfileMergeService, ProviderResponse } from './services/ProfileMergeService';

const discoveryEngine = new ProfileDiscoveryEngine();
const verificationEngine = new ProfileVerificationEngine();
const mergeService = new ProfileMergeService();

export class ProfileEnrichmentService {
  /**
   * Triggers the async enrichment pipeline via BullMQ queue.
   */
  public async triggerEnrichment(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
      include: { professionalProfile: true },
    });

    if (!contact) {
      throw new AppError('Contact not found or access denied', 404);
    }

    let profile = contact.professionalProfile;
    if (!profile) {
      profile = await prisma.professionalProfile.create({
        data: {
          contactId: contact.id,
        },
      });
    }

    await prisma.professionalProfile.update({
      where: { id: profile.id },
      data: { enrichmentStatus: 'QUEUED' as any },
    });

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

  /**
   * Orchestrates full multi-source discovery, verification, and merge.
   * 
   * Sources run in parallel: LinkedIn (RapidAPI) + GitHub + Company Website.
   * All verified sources are merged together.
   */
  public async runDiscoveryPipeline(contact: any): Promise<any> {
    const context = {
      name: contact.name,
      company: contact.company,
      designation: contact.designation,
      email: contact.email,
      website: contact.website,
      address: contact.address
    };

    logger.info(`[DiscoveryPipeline] ═══════════════════════════════════════`);
    logger.info(`[DiscoveryPipeline] Executing Discovery for: ${context.name}`);
    logger.info(`[DiscoveryPipeline] Company: ${context.company || 'N/A'}`);
    logger.info(`[DiscoveryPipeline] Designation: ${context.designation || 'N/A'}`);
    logger.info(`[DiscoveryPipeline] Email: ${context.email || 'N/A'}`);
    logger.info(`[DiscoveryPipeline] Website: ${context.website || 'N/A'}`);

    // Step 1: Full discovery (LinkedIn + GitHub + Company Website in parallel)
    const discoveryResult = await discoveryEngine.fullDiscovery(context);

    logger.info(`[DiscoveryPipeline] ─── Discovery Summary ───`);
    logger.info(`[DiscoveryPipeline] Search queries executed: ${discoveryResult.searchQueries.length}`);
    for (const q of discoveryResult.searchQueries) {
      logger.info(`[DiscoveryPipeline]   Query: ${q}`);
    }
    logger.info(`[DiscoveryPipeline] All discovered URLs (${discoveryResult.allDiscoveredUrls.length}):`);
    for (const u of discoveryResult.allDiscoveredUrls) {
      logger.info(`[DiscoveryPipeline]   ${u.source}: ${u.url}`);
    }
    logger.info(`[DiscoveryPipeline] LinkedIn URL selected: ${discoveryResult.linkedInUrl || 'NONE'}`);
    logger.info(`[DiscoveryPipeline] GitHub URL selected: ${discoveryResult.githubUrl || 'NONE'}`);
    logger.info(`[DiscoveryPipeline] Company Website: ${discoveryResult.companyWebsiteUrl || 'NONE'}`);
    if (discoveryResult.rejectionReasons.length > 0) {
      logger.info(`[DiscoveryPipeline] Rejection reasons:`);
      for (const r of discoveryResult.rejectionReasons) {
        logger.info(`[DiscoveryPipeline]   ✗ ${r}`);
      }
    }
    logger.info(`[DiscoveryPipeline] Total candidates: ${discoveryResult.candidates.length}`);

    const candidates = discoveryResult.candidates;

    if (!candidates || candidates.length === 0) {
      logger.info(`[DiscoveryPipeline] No candidate profiles discovered.`);
      return {
        providerResponses: [],
        mergedProfile: null,
        sourceAttribution: {},
        verification: { isVerified: false, confidence: 0, reasons: ['No candidates discovered'] },
        providersUsed: [],
        discoveryMeta: discoveryResult
      };
    }

    // Step 2: Verification — find best-verified candidate (used for primary contact matching)
    let bestCandidate: CandidateProfile | null = null;
    let bestVerification: any = { isVerified: false, confidence: 0, reasons: [] };

    for (const candidate of candidates) {
      const verifResult = verificationEngine.verify(context, candidate);
      logger.info(`[DiscoveryPipeline] Verification for ${candidate.source} (${candidate.fullName}): ${verifResult.confidence}% — ${verifResult.isVerified ? 'VERIFIED' : 'REJECTED'}`);
      if (verifResult.confidence > bestVerification.confidence) {
        bestCandidate = candidate;
        bestVerification = verifResult;
      }
    }

    // Prepare provider responses for ALL candidates (not just the best)
    const providersUsed = Array.from(new Set(candidates.map(c => c.source)));
    const providerResponses: ProviderResponse[] = candidates.map(c => ({
      sourceName: c.source,
      confidence: c.sourceConfidence,
      data: c
    }));

    logger.info(`[DiscoveryPipeline] Best candidate: ${bestCandidate ? bestCandidate.source : 'None'} — ${bestVerification.confidence}%`);

    // Step 3: Merge ALL provider responses together (LinkedIn + GitHub + CompanyWeb)
    logger.info(`[DiscoveryPipeline] Executing stage: Merge Service`);
    const { mergedProfile, sourceAttribution } = mergeService.mergeProfiles(providerResponses);

    logger.info(`[DiscoveryPipeline] ─── Merged Profile ───`);
    logger.info(`[DiscoveryPipeline] fullName: ${mergedProfile.fullName?.value}`);
    logger.info(`[DiscoveryPipeline] experience: ${mergedProfile.experience?.value?.length || 0} entries`);
    logger.info(`[DiscoveryPipeline] education: ${mergedProfile.education?.value?.length || 0} entries`);
    logger.info(`[DiscoveryPipeline] skills: ${mergedProfile.skills?.value?.length || 0} items`);
    logger.info(`[DiscoveryPipeline] repositories: ${(mergedProfile.repositories?.value || []).length} repos`);
    logger.info(`[DiscoveryPipeline] primaryLanguages: ${(mergedProfile.primaryLanguages?.value || []).join(', ')}`);
    logger.info(`[DiscoveryPipeline] technologies: ${(mergedProfile.technologies?.value || []).join(', ')}`);
    logger.info(`[DiscoveryPipeline] publicProfiles: ${(mergedProfile.publicProfiles?.value || []).map(p => p.platform + ':' + p.url).join(', ')}`);
    logger.info(`[DiscoveryPipeline] companyBio: ${mergedProfile.companyBio?.value ? 'yes' : 'no'}`);
    logger.info(`[DiscoveryPipeline] githubStats: ${mergedProfile.githubStats?.value ? JSON.stringify(mergedProfile.githubStats.value) : 'none'}`);

    return {
      providerResponses,
      mergedProfile,
      sourceAttribution,
      verification: bestVerification,
      providersUsed,
      discoveryMeta: discoveryResult
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
