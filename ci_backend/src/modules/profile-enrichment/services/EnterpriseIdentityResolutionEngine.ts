import logger from '../../../config/logger';
import { CandidateProfile } from './ProfileDiscoveryEngine';
import { stringSimilarity } from '../../../utils/stringUtils';
import { generateTextWithFallback } from '../../../utils/aiClient';

export interface OCRContext {
  name: string;
  company?: string | null;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
}

export class EnterpriseIdentityResolutionEngine {
  /**
   * Evaluates all candidates across 15 evidence signals and re-ranks them.
   */
  public async resolveIdentities(context: OCRContext, candidates: CandidateProfile[]): Promise<CandidateProfile[]> {
    logger.info(`[IdentityResolutionEngine] Starting identity resolution for ${candidates.length} candidates...`);

    // 1. Initial heuristic scoring for all candidates (Signals 1-14)
    for (const candidate of candidates) {
      let identityScore = 0;
      const reasons: string[] = [];
      const cStr = JSON.stringify(candidate).toLowerCase();

      // Extract domains and usernames for cross-reference
      const bcEmailDomain = this.extractDomain(context.email);
      const bcWebDomain = this.extractDomain(context.website);
      
      const candidateUsernames = this.extractUsernames(candidate);
      const candidateDomains = this.extractWebsiteDomains(candidate);

      // --- SIGNAL 1: Email Match ---
      if (context.email) {
        if (cStr.includes(context.email.toLowerCase())) {
          identityScore += 50;
          reasons.push('✔ Exact Email Match');
        }
      }

      // --- SIGNAL 2: Email Domain ---
      if (bcEmailDomain) {
        const cComp = candidate.company?.toLowerCase() || '';
        const hasExpComp = candidate.experience.some(e => e.company.toLowerCase().includes(bcEmailDomain.split('.')[0]));
        if (cComp.includes(bcEmailDomain.split('.')[0]) || hasExpComp) {
          identityScore += 20;
          reasons.push('✔ Email Domain Aligns with Company');
        }
      }

      // --- SIGNAL 3: Company Name Similarity ---
      if (context.company) {
        let bestCompSim = candidate.company ? stringSimilarity(context.company, candidate.company) : 0;
        for (const exp of candidate.experience) {
          bestCompSim = Math.max(bestCompSim, stringSimilarity(context.company, exp.company));
        }
        if (bestCompSim > 0.8) {
          identityScore += 20;
          reasons.push('✔ Strong Company Match');
        } else if (bestCompSim > 0.5) {
          identityScore += 10;
          reasons.push('✔ Fuzzy Company Match');
        }
      }

      // --- SIGNAL 4: Designation Similarity ---
      if (context.designation) {
        let bestDesigSim = 0;
        if (candidate.designation) bestDesigSim = Math.max(bestDesigSim, stringSimilarity(context.designation, candidate.designation));
        if (candidate.headline) bestDesigSim = Math.max(bestDesigSim, stringSimilarity(context.designation, candidate.headline));
        for (const exp of candidate.experience) {
          bestDesigSim = Math.max(bestDesigSim, stringSimilarity(context.designation, exp.title));
        }
        
        // Very basic semantic matching check (e.g. Engineer vs Developer)
        const sem1 = context.designation.toLowerCase();
        const sem2 = (candidate.headline || candidate.designation || '').toLowerCase();
        const isSemantic = (sem1.includes('engineer') && sem2.includes('developer')) || (sem1.includes('developer') && sem2.includes('engineer'));

        if (bestDesigSim > 0.7 || isSemantic) {
          identityScore += 15;
          reasons.push('✔ Designation/Role Match');
        }
      }

      // --- SIGNAL 5: Website Domain Matching ---
      if (bcWebDomain && candidateDomains.includes(bcWebDomain)) {
        identityScore += 20;
        reasons.push('✔ Website Domain Match');
      }

      // --- SIGNAL 6, 7, 9, 10, 13, 14: Cross Platform (Requires looking at OTHER candidates) ---
      let sharedUsername = false;
      let sharedWebsite = false;
      let sharedCompany = false;
      let socialGraphLink = false;
      let companyWebVerified = candidate.source === 'Company Website';
      let portfolioVerified = candidate.source === 'Portfolio Scraper';

      for (const other of candidates) {
        if (other === candidate) continue;
        
        const otherUsernames = this.extractUsernames(other);
        const otherDomains = this.extractWebsiteDomains(other);

        // Signal 6: Shared Username
        if (candidateUsernames.some(u => otherUsernames.includes(u))) sharedUsername = true;
        
        // Signal 14: Shared Website
        if (candidateDomains.some(d => otherDomains.includes(d)) && candidateDomains.length > 0) sharedWebsite = true;

        // Signal 7: Cross Platform Consistency (Company)
        if (candidate.company && other.company && stringSimilarity(candidate.company, other.company) > 0.8) sharedCompany = true;

        // Signal 13: Social Graph Link (Does other candidate link to THIS candidate's URL?)
        if (candidate.publicProfiles.length > 0 && candidate.publicProfiles[0].url) {
           const myUrl = candidate.publicProfiles[0].url.toLowerCase();
           if (JSON.stringify(other).toLowerCase().includes(myUrl)) {
             socialGraphLink = true;
           }
        }

        // Signal 9 & 10: Verified by Company/Portfolio
        if (other.source === 'Company Website' && stringSimilarity(candidate.fullName, other.fullName) > 0.8) companyWebVerified = true;
        if (other.source === 'Portfolio Scraper' && stringSimilarity(candidate.fullName, other.fullName) > 0.8) portfolioVerified = true;
      }

      if (sharedUsername) { identityScore += 15; reasons.push('✔ Cross-Platform Username Match'); }
      if (sharedCompany) { identityScore += 15; reasons.push('✔ Cross-Platform Consistency'); }
      if (companyWebVerified) { identityScore += 20; reasons.push('✔ Company Website Verification'); }
      if (portfolioVerified) { identityScore += 15; reasons.push('✔ Portfolio Verification'); }
      if (socialGraphLink) { identityScore += 25; reasons.push('✔ Social Graph Consistency'); }
      if (sharedWebsite) { identityScore += 20; reasons.push('✔ Website Ownership Match'); }

      // --- SIGNAL 8: Bio Matching ---
      if (context.designation && context.company) {
        const bio = (candidate.summary || candidate.headline || candidate.companyBio || '').toLowerCase();
        const dTokens = context.designation.toLowerCase().split(' ');
        const cTokens = context.company.toLowerCase().split(' ');
        if (bio.length > 10 && dTokens.some(t => t.length > 3 && bio.includes(t)) && cTokens.some(t => t.length > 3 && bio.includes(t))) {
           identityScore += 15;
           reasons.push('✔ Bio Matches BC Keywords');
        }
      }

      // --- SIGNAL 11: Technology Matching ---
      const bcStr = JSON.stringify(context).toLowerCase();
      const techKeywords = ['ai', 'cloud', 'react', 'node', 'spring', 'java', 'python', 'aws', 'azure'];
      const bcTech = techKeywords.filter(t => bcStr.includes(t));
      if (bcTech.length > 0) {
        const cTechStr = [...candidate.skills, ...(candidate.technologies || []), ...(candidate.primaryLanguages || [])].join(' ').toLowerCase();
        if (bcTech.some(t => cTechStr.includes(t))) {
          identityScore += 15;
          reasons.push('✔ Technology Stack Match');
        }
      }

      // --- SIGNAL 12: Location Matching ---
      if (context.address && candidate.location) {
        if (stringSimilarity(context.address, candidate.location) > 0.5) {
          identityScore += 10;
          reasons.push('✔ Location Match');
        }
      }

      // Scale Identity Score and Add to Candidate
      const finalIdentityBoost = Math.min(identityScore, 50);
      
      candidate.sourceConfidence = Math.min(candidate.sourceConfidence + finalIdentityBoost, 99);
      
      if (reasons.length > 0) {
        const existingReasons = (candidate as any).verificationReasons || [];
        (candidate as any).verificationReasons = [...existingReasons, ...reasons];
        
        if (candidate.publicProfiles.length > 0) {
           candidate.publicProfiles[0].reasons = [...(candidate.publicProfiles[0].reasons || []), ...reasons];
           candidate.publicProfiles[0].confidence = candidate.sourceConfidence;
        }
      }
    }

    // 2. Sort candidates by New Score before AI Verification
    candidates.sort((a, b) => b.sourceConfidence - a.sourceConfidence);

    // 3. --- SIGNAL 15: AI Identity Verification ---
    const topCandidates = candidates.slice(0, 5);
    if (topCandidates.length > 0) {
      logger.info(`[IdentityResolutionEngine] Running AI Identity Verification on top ${topCandidates.length} candidates...`);
      try {
        const prompt = this.buildAIPrompt(context, topCandidates);
        const aiResponse = await generateTextWithFallback(prompt, 'gemini-1.5-pro', 'Identity Verification');
        this.applyAIAdjustments(aiResponse, topCandidates);
      } catch (e: any) {
        logger.error(`[IdentityResolutionEngine] AI Verification Failed: ${e.message}`);
      }
    }

    // Final Sort
    candidates.sort((a, b) => b.sourceConfidence - a.sourceConfidence);
    return candidates;
  }

  private extractDomain(str?: string | null): string | null {
    if (!str) return null;
    try {
      if (str.includes('@')) str = str.split('@')[1];
      if (!str.startsWith('http')) str = 'https://' + str;
      let host = new URL(str).hostname;
      if (host.startsWith('www.')) host = host.substring(4);
      return host;
    } catch {
      return null;
    }
  }

  private extractUsernames(candidate: CandidateProfile): string[] {
    const usernames: string[] = [];
    for (const p of candidate.publicProfiles) {
      if (p.url) {
        const match = p.url.match(/([^\/]+)\/?$/);
        if (match && match[1]) {
           let un = match[1].split('?')[0];
           if (!['in', 'company', 'school'].includes(un)) {
             usernames.push(un.toLowerCase().replace(/[^a-z0-9]/g, ''));
           }
        }
      }
    }
    if (candidate.githubStats?.login) usernames.push(candidate.githubStats.login.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return usernames;
  }

  private extractWebsiteDomains(candidate: CandidateProfile): string[] {
    const domains: string[] = [];
    if (candidate.companyBio && candidate.publicProfiles.some(p => p.platform === 'Company Website')) {
       const p = candidate.publicProfiles.find(p => p.platform === 'Company Website');
       if (p) {
         const d = this.extractDomain(p.url);
         if (d) domains.push(d);
       }
    }
    if (candidate.source === 'Portfolio Scraper' && candidate.publicProfiles.length > 0) {
      const d = this.extractDomain(candidate.publicProfiles[0].url);
      if (d) domains.push(d);
    }
    return domains;
  }

  private buildAIPrompt(context: OCRContext, candidates: CandidateProfile[]): string {
    const summarizedCandidates = candidates.map((c, idx) => ({
      id: idx,
      source: c.source,
      name: c.fullName,
      headline: c.headline || c.designation || c.summary?.substring(0, 50),
      company: c.company,
      location: c.location,
      urls: c.publicProfiles.map(p => p.url).join(', '),
      existingConfidence: c.sourceConfidence,
      identityReasons: ((c as any).verificationReasons || []).filter((r: string) => r.startsWith('✔'))
    }));

    return `
You are an Enterprise Identity Resolution AI.
Determine which candidate most likely belongs to this business card.
Explain your reasoning.
Rank the candidates from best to worst.
Do not invent information.
Use only the provided evidence.

Business Card:
${JSON.stringify(context, null, 2)}

Candidates:
${JSON.stringify(summarizedCandidates, null, 2)}

Output strict JSON format ONLY. Do not include markdown blocks (\`\`\`json).
{
  "rankings": [
    {
      "candidateId": 0,
      "reason": "Clear explanation of why this is or isn't the person.",
      "confidenceAdjustment": 15
    }
  ]
}`;
  }

  private applyAIAdjustments(aiResponse: string, topCandidates: CandidateProfile[]) {
    try {
      const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      if (parsed.rankings && Array.isArray(parsed.rankings)) {
        for (const rank of parsed.rankings) {
          const candidate = topCandidates[rank.candidateId];
          if (candidate) {
            candidate.sourceConfidence = Math.max(0, Math.min(candidate.sourceConfidence + rank.confidenceAdjustment, 100));
            const aiReason = `AI Verification: ${rank.reason}`;
            (candidate as any).verificationReasons = [...((candidate as any).verificationReasons || []), aiReason];
            if (candidate.publicProfiles.length > 0) {
              candidate.publicProfiles[0].reasons = [...(candidate.publicProfiles[0].reasons || []), aiReason];
              candidate.publicProfiles[0].confidence = candidate.sourceConfidence;
            }
          }
        }
      }
    } catch (e: any) {
      logger.error(`[IdentityResolutionEngine] Failed to parse AI JSON response: ${e.message}`);
      logger.error(`[IdentityResolutionEngine] Raw Response: ${aiResponse}`);
    }
  }
}
