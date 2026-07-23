import { enrichmentQueue } from '../../queue/queue';
import prisma from '../../config/db';
import { AppError } from '../../utils/AppError';
import logger from '../../config/logger';
import { generateTextWithFallback } from '../../utils/aiClient';

import { IdentityResolver } from './services/IdentityResolver';
import { SearchIntelligenceEngine } from './services/SearchIntelligenceEngine';
import { ProfileDiscoveryEngine, CandidateProfile } from './services/ProfileDiscoveryEngine';
import { SearchRankingEngine } from './services/SearchRankingEngine';
import { ProfileMergeService, ProviderResponse } from './services/ProfileMergeService';
import { EnterpriseIdentityResolutionEngine } from './services/EnterpriseIdentityResolutionEngine';

const identityResolver = new IdentityResolver();
const searchIntelligenceEngine = new SearchIntelligenceEngine();
const discoveryEngine = new ProfileDiscoveryEngine();
const rankingEngine = new SearchRankingEngine();
const mergeService = new ProfileMergeService();
const identityResolutionEngine = new EnterpriseIdentityResolutionEngine();

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

    // Step 0.5: Identity Extraction for Search Intelligence & Ranking
    const signals = identityResolver.resolve(context);

    // Step 0.75: Optional Knowledge Graph Enrichment (Search Intelligence Engine)
    const kgEntity = await searchIntelligenceEngine.queryKnowledgeGraph(signals);

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

    // Step 2: Rank every candidate using Search Ranking Engine (Highest/High/Medium/Low Weights)
    const rankedCandidates = rankingEngine.rankCandidates(signals, candidates);

    // Step 2.5: Identity Resolution Engine (Re-ranks candidates based on 15 signals + AI)
    const identityResolvedCandidates = await identityResolutionEngine.resolveIdentities(context, rankedCandidates);

    const acceptedCandidates = identityResolvedCandidates.filter(c => c.sourceConfidence >= 70);
    const rejectedCandidates = identityResolvedCandidates.filter(c => c.sourceConfidence < 70);

    logger.info(`[DiscoveryPipeline] ─── Candidate Ranking Summary ───`);
    logger.info(`[DiscoveryPipeline] Total Discovered Candidates: ${identityResolvedCandidates.length}`);
    for (const c of identityResolvedCandidates) {
      logger.info(`[DiscoveryPipeline]   Candidate: ${c.fullName} | Source: ${c.source} | Confidence: ${c.sourceConfidence}% | Status: ${c.verificationStatus}`);
      logger.info(`[DiscoveryPipeline]   Reasons: ${(c as any).verificationReasons.join('; ')}`);
    }
    logger.info(`[DiscoveryPipeline] Accepted Candidates: ${acceptedCandidates.length}`);
    logger.info(`[DiscoveryPipeline] Rejected Candidates: ${rejectedCandidates.length}`);

    // Prepare provider responses for VIABLE candidates (sorted by final confidence descending)
    // We filter out completely mismatched candidates (confidence < 40) so they don't pollute the frontend UI.
    const viableCandidates = identityResolvedCandidates.filter(c => c.sourceConfidence >= 40);

    const providersUsed = Array.from(new Set(viableCandidates.map(c => c.source)));
    const providerResponses: ProviderResponse[] = viableCandidates.map(c => ({
      sourceName: c.source,
      confidence: c.sourceConfidence,
      data: c
    }));

    const bestCandidate = identityResolvedCandidates[0] || null;
    const bestVerification = bestCandidate ? {
      isVerified: bestCandidate.sourceConfidence >= 70,
      confidence: bestCandidate.sourceConfidence,
      reasons: (bestCandidate as any).verificationReasons || []
    } : { isVerified: false, confidence: 0, reasons: ['No candidates discovered'] };

    logger.info(`[DiscoveryPipeline] Best candidate: ${bestCandidate ? bestCandidate.source : 'None'} — ${bestVerification.confidence}%`);

    // ─── NEW: Identity Contamination Prevention ───
    // Only merge candidates that are confidently linked to the best candidate.
    // This prevents merging Saranya (TCS) with Saranya (Cloud Destinations).
    
    const linkedResponses = providerResponses.filter(pr => {
      if (pr.data === bestCandidate) return true;
      
      const bestUrls = bestCandidate?.publicProfiles?.map((p: any) => p.url.toLowerCase()) || [];
      const cUrls = pr.data.publicProfiles?.map((p: any) => p.url.toLowerCase()) || [];
      
      // 1. Exact URL Match (They link to the same public profile)
      if (bestUrls.some((u: string) => cUrls.includes(u))) return true;
      
      // 2. Social Graph Link (One profile explicitly references the other)
      const cStr = JSON.stringify(pr.data).toLowerCase();
      if (bestUrls.some((u: string) => cStr.includes(u))) return true;
      
      const bestStr = JSON.stringify(bestCandidate).toLowerCase();
      if (cUrls.some((u: string) => bestStr.includes(u))) return true;

      // 3. Perfect Name AND Company match
      if (bestCandidate?.fullName && bestCandidate?.company &&
          pr.data.fullName && pr.data.company &&
          bestCandidate.fullName.toLowerCase() === pr.data.fullName.toLowerCase() &&
          bestCandidate.company.toLowerCase() === pr.data.company.toLowerCase()) {
          return true;
      }
      
      return false; // Reject: Belongs to a different person
    });

    // Step 3: Merge ONLY confidently linked candidates together (LinkedIn + GitHub + CompanyWeb of the SAME person)
    logger.info(`[DiscoveryPipeline] Executing stage: Merge Service for ${linkedResponses.length} confidently linked profiles`);
    const { mergedProfile, sourceAttribution } = mergeService.mergeProfiles(linkedResponses);

    // Save searchProcess inside mergedProfile and sourceAttribution
    const timestamp = new Date().toISOString();
    mergedProfile.searchProcess = {
      value: discoveryResult.searchProcess || {},
      source: 'Pipeline Log',
      confidence: 100,
      timestamp,
      verification: 'Verified'
    };
    sourceAttribution.searchProcess = mergedProfile.searchProcess;

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

    // Step 4: Generate Professional Summary from public verified data (ONLY FOR SELECTED CANDIDATE)
    logger.info(`[DiscoveryPipeline] Executing stage: Professional Summary Generation`);
    try {
      // Use ONLY the linked responses
      const pubBios = linkedResponses.map(p => p.data.headline || p.data.summary || p.data.companyBio).filter(Boolean);
      const exp = mergedProfile.experience?.value || [];
      const edu = mergedProfile.education?.value || [];
      const skills = mergedProfile.skills?.value || [];
      const repos = mergedProfile.repositories?.value || [];
      
      const hasEnoughInfo = pubBios.length > 0 || exp.length > 0 || repos.length > 0;
      
      if (hasEnoughInfo && bestCandidate) {
        const summaryPrompt = `You are an expert professional biographer.
Generate a concise, professional summary for this person using ONLY the following verified public information.
DO NOT fabricate or hallucinate any information.
Write the summary in the third person starting with: "Based on verified public information, ${mergedProfile.fullName?.value || 'this individual'} is..."
Describe the person, NOT the system. Do NOT output generic sentences about the availability of information.

Information:
--- Business Card Information ---
Name: ${contact.name}
Company: ${contact.company || 'N/A'}
Designation: ${contact.designation || 'N/A'}

--- Selected Candidate Information & Verified Public Evidence ---
Name: ${mergedProfile.fullName?.value || 'Unknown'}
Bios/Headlines: ${JSON.stringify(pubBios)}
Experience: ${JSON.stringify(exp)}
Education: ${JSON.stringify(edu)}
Skills/Tech: ${JSON.stringify(skills)}
Projects/Repos: ${JSON.stringify(repos)}
${kgEntity ? `Google Knowledge Graph Info: ${JSON.stringify(kgEntity)}` : ''}`;

        const aiSummary = await generateTextWithFallback(summaryPrompt, 'gemini-1.5-pro', 'Professional Summary');
        mergedProfile.summary = {
          value: aiSummary.trim(),
          source: bestCandidate.source,
          confidence: 95,
          timestamp: new Date().toISOString(),
          verification: 'Verified'
        };
        sourceAttribution.summary = mergedProfile.summary;
      } else {
        mergedProfile.summary = {
          value: "No verified public professional biography could be generated.",
          source: 'System',
          confidence: 100,
          timestamp: new Date().toISOString(),
          verification: 'Verified'
        };
        sourceAttribution.summary = mergedProfile.summary;
      }
    } catch (e: any) {
      logger.warn(`[DiscoveryPipeline] Failed to generate professional summary: ${e.message}`);
    }

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
