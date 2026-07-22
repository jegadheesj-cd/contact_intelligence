import { stringSimilarity } from '../../../utils/stringUtils';
import logger from '../../../config/logger';
import { CandidateProfile } from './ProfileDiscoveryEngine';

export interface VerificationResult {
  isVerified: boolean;
  confidence: number;
  reasons: string[];
}

export class ProfileVerificationEngine {
  /**
   * Verifies that the discovered candidate profile matches the target OCR contact.
   * Uses weighted exact matching:
   * - Name Match: 35%
   * - Email / Phone Match: 25%
   * - Company Match: 20%
   * - Website Match: 10%
   * - Location Match: 5%
   * - Designation Match: 5%
   */
  public verify(
    ocrContact: {
      name: string;
      company?: string | null;
      designation?: string | null;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      address?: string | null;
    },
    candidate: CandidateProfile
  ): VerificationResult {
    logger.info(`[ProfileVerificationEngine] Running weighted matching verification for: ${candidate.fullName}`);
    
    let totalScore = 0;
    const reasons: string[] = [];

    const getEmailDomain = (emailStr: string | null | undefined): string | null => {
      if (!emailStr) return null;
      const parts = emailStr.toLowerCase().split('@');
      if (parts.length < 2) return null;
      const domain = parts[1];
      const ignored = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com'];
      return ignored.includes(domain) ? null : domain;
    };

    const getWebsiteDomain = (urlStr: string | null | undefined): string | null => {
      if (!urlStr) return null;
      try {
        let host = urlStr.toLowerCase();
        if (!host.startsWith('http://') && !host.startsWith('https://')) {
          host = 'https://' + host;
        }
        const parsed = new URL(host);
        let hostname = parsed.hostname;
        if (hostname.startsWith('www.')) hostname = hostname.substring(4);
        return hostname;
      } catch (e) {
        return null;
      }
    };

    const getUsername = (urlStr: string | null | undefined): string | null => {
      if (!urlStr) return null;
      const match = urlStr.match(/([^\/]+)\/?$/);
      return match ? match[1].split('?')[0].toLowerCase() : null;
    };

    const candidateStr = JSON.stringify(candidate).toLowerCase();
    
    // --- HIGHEST WEIGHT (60%) ---

    // 1. Name Match (Weight: 30)
    const nameSim = stringSimilarity(ocrContact.name.toLowerCase(), candidate.fullName.toLowerCase());
    const namePoints = Math.round(nameSim * 30 * 10) / 10;
    totalScore += namePoints;
    if (nameSim > 0.8) {
      reasons.push(`✔ Name Match`);
    } else {
      reasons.push(`Name Similarity: ${(nameSim * 100).toFixed(0)}%`);
    }

    // 2. Email / Phone Match (Weight: 20) & Email Domain Match (Weight: 10)
    if (ocrContact.email || ocrContact.phone) {
      const ocrDomain = getEmailDomain(ocrContact.email);
      let matchedEmailPhone = false;
      let matchedEmailDomain = false;
      
      if (ocrContact.email && candidateStr.includes(ocrContact.email.toLowerCase())) matchedEmailPhone = true;
      if (ocrContact.phone && candidateStr.includes(ocrContact.phone.replace(/[^0-9]/g, ''))) matchedEmailPhone = true;
      
      if (ocrDomain && candidate.company && candidate.company.toLowerCase().includes(ocrDomain.split('.')[0])) matchedEmailDomain = true;
      if (ocrDomain && candidate.publicProfiles.some(p => p.url.toLowerCase().includes(ocrDomain))) matchedEmailDomain = true;
      
      if (matchedEmailPhone) {
        totalScore += 20;
        reasons.push(`✔ Exact ${ocrContact.email && candidateStr.includes(ocrContact.email.toLowerCase()) ? 'Email' : 'Phone'} Match`);
      } else {
        reasons.push(`✖ No Exact Email/Phone Match`);
      }

      if (matchedEmailDomain) {
        totalScore += 10;
        reasons.push(`✔ Email Domain`);
      } else {
        reasons.push(`✖ No Email Domain Match`);
      }
    } else {
      totalScore += 15; // Neutral average score
    }

    // --- HIGH WEIGHT (25%) ---

    // 3. Company Match (Weight: 15)
    if (ocrContact.company) {
      let bestCompSim = 0;
      const ocrCompany = ocrContact.company; // Store in local variable to satisfy TypeScript
      if (candidate.company) bestCompSim = Math.max(bestCompSim, stringSimilarity(ocrCompany.toLowerCase(), candidate.company.toLowerCase()));
      if (candidate.experience) {
        candidate.experience.forEach(exp => {
          if (exp.company) bestCompSim = Math.max(bestCompSim, stringSimilarity(ocrCompany.toLowerCase(), exp.company.toLowerCase()));
        });
      }
      const compPoints = Math.round(bestCompSim * 15 * 10) / 10;
      totalScore += compPoints;
      
      if (bestCompSim > 0.7) reasons.push(`✔ Company Match`);
      else reasons.push(`✖ Company Mismatch`);
    } else {
      totalScore += 7.5;
    }

    // 4. Company Website Match (Weight: 10)
    if (ocrContact.website) {
      const ocrWebDomain = getWebsiteDomain(ocrContact.website);
      let matchedWeb = false;
      if (ocrWebDomain) {
        if (candidate.publicProfiles.some(p => getWebsiteDomain(p.url) === ocrWebDomain)) matchedWeb = true;
        if (candidate.companyBio) matchedWeb = true; 
      }
      if (matchedWeb) {
        totalScore += 10;
        reasons.push(`✔ Company Website`);
      } else {
        reasons.push(`✖ Website Mismatch`);
      }
    } else {
      totalScore += 5;
    }

    // --- MEDIUM WEIGHT (10%) ---

    // 5. Username Similarity (Weight: 4) & Public Website Match (Weight: 3)
    let usernamePoints = 0;
    let socialLinksPoints = 0;
    if (ocrContact.email) {
      const emailPrefix = ocrContact.email.split('@')[0].toLowerCase();
      const usernames = candidate.publicProfiles.map(p => getUsername(p.url)).filter(Boolean) as string[];
      if (usernames.some(u => u.includes(emailPrefix) || emailPrefix.includes(u))) {
        usernamePoints = 4;
        reasons.push(`✔ Username Match`);
      }
    }
    
    // Cross platform references (Does the candidate link to other known social profiles?)
    if (candidate.publicProfiles.length > 1) {
      socialLinksPoints = 3;
    }

    totalScore += usernamePoints + socialLinksPoints;

    // 6. Location Match (Weight: 3)
    if (ocrContact.address) {
      let locSim = 0;
      if (candidate.location) locSim = stringSimilarity(ocrContact.address.toLowerCase(), candidate.location.toLowerCase());
      const locPoints = Math.round(locSim * 3 * 10) / 10;
      totalScore += locPoints;
      if (locSim > 0.6) reasons.push(`✔ Location`);
    } else {
      totalScore += 1.5;
    }

    // --- LOW WEIGHT (5%) ---

    // 7. Designation Similarity (Weight: 5)
    if (ocrContact.designation) {
      let bestDesigSim = 0;
      if (candidate.designation) bestDesigSim = Math.max(bestDesigSim, stringSimilarity(ocrContact.designation.toLowerCase(), candidate.designation.toLowerCase()));
      if (candidate.headline) bestDesigSim = Math.max(bestDesigSim, stringSimilarity(ocrContact.designation.toLowerCase(), candidate.headline.toLowerCase()));
      const desigPoints = Math.round(bestDesigSim * 5 * 10) / 10;
      totalScore += desigPoints;
      if (bestDesigSim > 0.6) reasons.push(`✔ Designation`);
    } else {
      totalScore += 2.5;
    }

    const finalScore = Math.min(Math.round(totalScore), 100);
    logger.info(`[ProfileVerificationEngine] Final verification score: ${finalScore}%`);

    return {
      isVerified: finalScore >= 70,
      confidence: finalScore,
      reasons,
    };
  }
}
