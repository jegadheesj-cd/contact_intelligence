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
   * Uses exact weighted matching weights:
   * - Email Domain / Match: 40%
   * - Company: 25%
   * - Designation: 15%
   * - Website Domain: 10%
   * - Location: 5%
   * - Name Similarity: 5%
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

    // Helper to extract email domain
    const getEmailDomain = (emailStr: string | null | undefined): string | null => {
      if (!emailStr) return null;
      const parts = emailStr.toLowerCase().split('@');
      if (parts.length < 2) return null;
      const domain = parts[1];
      const ignored = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com'];
      return ignored.includes(domain) ? null : domain;
    };

    // Helper to extract website domain
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

    // 1. Name Similarity Match (Weight: 5)
    const nameSim = stringSimilarity(ocrContact.name.toLowerCase(), candidate.fullName.toLowerCase());
    const namePoints = Math.round(nameSim * 5 * 10) / 10;
    totalScore += namePoints;
    reasons.push(`Name Similarity: ${(nameSim * 100).toFixed(0)}% (weighted: ${namePoints}/5)`);

    // 2. Email Match / Email Domain Match (Weight: 40)
    if (ocrContact.email) {
      let emailPoints = 0;
      const ocrDomain = getEmailDomain(ocrContact.email);
      
      // Check if email matches any public profiles/text/stubs
      if (candidate.publicProfiles.some(p => p.url.toLowerCase().includes(ocrContact.email!.toLowerCase()))) {
        emailPoints = 40;
        reasons.push(`Email Match: Direct email match found in public profile URL (weighted: 40/40)`);
      } else if (ocrDomain && candidate.company && candidate.company.toLowerCase().includes(ocrDomain.split('.')[0])) {
        emailPoints = 32;
        reasons.push(`Email Match: Domain "${ocrDomain}" aligns with candidate company "${candidate.company}" (weighted: 32/40)`);
      } else {
        emailPoints = 8;
        reasons.push(`Email Match: Email present but mismatch with candidate company/metadata (weighted: 8/40)`);
      }
      totalScore += emailPoints;
    } else {
      totalScore += 20; // Neutral average score when ocr does not have email
      reasons.push(`Email Match: Email not present in OCR (+20 neutral)`);
    }

    // 3. Company Match (Weight: 25)
    if (ocrContact.company) {
      let bestCompSim = 0;
      if (candidate.company) {
        bestCompSim = Math.max(bestCompSim, stringSimilarity(ocrContact.company.toLowerCase(), candidate.company.toLowerCase()));
      }
      if (candidate.experience && candidate.experience.length > 0) {
        for (const exp of candidate.experience) {
          if (exp.company) {
            bestCompSim = Math.max(bestCompSim, stringSimilarity(ocrContact.company.toLowerCase(), exp.company.toLowerCase()));
          }
        }
      }
      const compPoints = Math.round(bestCompSim * 25 * 10) / 10;
      totalScore += compPoints;
      reasons.push(`Company Match: ${(bestCompSim * 100).toFixed(0)}% (weighted: ${compPoints}/25)`);
    } else {
      totalScore += 12.5;
      reasons.push(`Company Match: Company not present in OCR (+12.5 neutral)`);
    }

    // 4. Website Domain Match (Weight: 10)
    if (ocrContact.website) {
      let webPoints = 0;
      const ocrWebDomain = getWebsiteDomain(ocrContact.website);
      const candidateWebDomain = candidate.publicProfiles.length > 0 ? getWebsiteDomain(candidate.publicProfiles[0].url) : null;
      
      if (ocrWebDomain && candidateWebDomain && ocrWebDomain === candidateWebDomain) {
        webPoints = 10;
        reasons.push(`Website Match: Perfect website domain match "${ocrWebDomain}" (weighted: 10/10)`);
      } else if (ocrWebDomain && candidate.company && candidate.company.toLowerCase().includes(ocrWebDomain.split('.')[0])) {
        webPoints = 8;
        reasons.push(`Website Match: Domain "${ocrWebDomain}" matches company name "${candidate.company}" (weighted: 8/10)`);
      } else {
        webPoints = 3;
        reasons.push(`Website Match: No website alignment (weighted: 3/10)`);
      }
      totalScore += webPoints;
    } else {
      totalScore += 5;
      reasons.push(`Website Match: Website not present in OCR (+5 neutral)`);
    }

    // 5. Designation Match (Weight: 15)
    if (ocrContact.designation) {
      let bestDesigSim = 0;
      if (candidate.designation) {
        bestDesigSim = Math.max(bestDesigSim, stringSimilarity(ocrContact.designation.toLowerCase(), candidate.designation.toLowerCase()));
      }
      if (candidate.headline) {
        bestDesigSim = Math.max(bestDesigSim, stringSimilarity(ocrContact.designation.toLowerCase(), candidate.headline.toLowerCase()));
      }
      const desigPoints = Math.round(bestDesigSim * 15 * 10) / 10;
      totalScore += desigPoints;
      reasons.push(`Designation Match: ${(bestDesigSim * 100).toFixed(0)}% (weighted: ${desigPoints}/15)`);
    } else {
      totalScore += 7.5;
      reasons.push(`Designation Match: Designation not present in OCR (+7.5 neutral)`);
    }

    // 6. Location Match (Weight: 5)
    if (ocrContact.address) {
      let locSim = 0;
      if (candidate.location) {
        locSim = stringSimilarity(ocrContact.address.toLowerCase(), candidate.location.toLowerCase());
      }
      const locPoints = Math.round(locSim * 5 * 10) / 10;
      totalScore += locPoints;
      reasons.push(`Location Match: ${(locSim * 100).toFixed(0)}% (weighted: ${locPoints}/5)`);
    } else {
      totalScore += 2.5;
      reasons.push(`Location Match: Location not present in OCR (+2.5 neutral)`);
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
